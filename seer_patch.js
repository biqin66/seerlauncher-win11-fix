/*
 * SeerLauncher 通用补丁器（纯 Node.js，无第三方依赖）
 * 作用：修复 Win11 上「获取游戏」无响应，并让游戏/下载包按启动器相对路径安装。
 *   ① getWindowsDiskSpace 去掉 wmic（改 fs.statfs + PowerShell CIM 兜底）
 *   ② 游戏目录默认取启动器目录（initGameState 盘符判定恒走 else）
 *   ③④ 关闭两处 "C盘特判"，安装/下载恒走 <启动器目录>\Games | \Download
 * 用法： node seer_patch.js [启动器安装目录]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function die(msg) { console.error('\n[失败] ' + msg + '\n'); process.exit(1); }
function info(msg) { console.log(msg); }

// ---------- 1. 定位安装目录 ----------
// 约定:把整个“通用补丁器”文件夹放进 SeerLauncher 安装目录内再运行,
// 因此安装目录 = 本脚本所在目录的上一级（<SeerLauncher>\通用补丁器\seer_patch.js → <SeerLauncher>）。
function findInstallDir() {
  const cands = [];
  if (process.argv[2]) cands.push(process.argv[2]);        // ① 命令行显式指定优先
  cands.push(path.dirname(__dirname));                      // ② 主路径:脚本目录的父目录
  cands.push(__dirname);                                    // ③ 兜底:直接放在 SeerLauncher 根目录
  cands.push('C:\\Program Files (x86)\\SeerLauncher');      // ④ 兜底:常见安装路径
  cands.push('C:\\Program Files\\SeerLauncher');
  if (process.env.LOCALAPPDATA) cands.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'SeerLauncher'));
  for (const d of cands) {
    if (d && fs.existsSync(path.join(d, 'resources', 'app.asar'))) return d;
  }
  return null;
}

// ---------- 2. 解析 asar ----------
function readAsar(file) {
  const buf = fs.readFileSync(file);
  const headerBufLen = buf.readUInt32LE(4);       // = 8 + jsonLen + pad
  const jsonLen = buf.readUInt32LE(12);
  const json = buf.subarray(16, 16 + jsonLen).toString('utf8');
  const contentBase = 8 + headerBufLen;           // 内容区起始
  return { buf, header: JSON.parse(json), contentBase };
}

function integrityOf(b) {
  const BS = 4194304;
  const blocks = [];
  for (let i = 0; i < b.length; i += BS) blocks.push(crypto.createHash('sha256').update(b.subarray(i, i + BS)).digest('hex'));
  if (!blocks.length) blocks.push(crypto.createHash('sha256').update(b).digest('hex'));
  return { algorithm: 'SHA256', hash: crypto.createHash('sha256').update(b).digest('hex'), blockSize: BS, blocks };
}

// 收集所有“已打包”文件节点（带 offset、非 unpacked），DFS
function collectFiles(header, base) {
  const list = [];
  (function walk(node, p) {
    if (node.files) for (const k of Object.keys(node.files)) walk(node.files[k], p ? p + '/' + k : k);
    else if (!node.unpacked && node.offset !== undefined) list.push({ node, p });
  })(header, '');
  return list;
}

function getContent(asar, node) {
  const off = Number(node.offset);
  return asar.buf.subarray(asar.contentBase + off, asar.contentBase + off + node.size);
}

// 按花括号配平替换具名函数
function replaceFunction(src, name, replacement) {
  const sig = 'function ' + name;
  const s = src.indexOf(sig);
  if (s < 0) return null;
  let i = src.indexOf('{', s), depth = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } } }
  return src.slice(0, s) + replacement + src.slice(j);
}

// ---------- 3. 补丁内容 ----------
const NEW_DISK_FN =
`function getWindowsDiskSpace(driveLetter) {
    var _fs = require('fs'), _cp = require('child_process');
    return new Promise(function (resolve) {
        function _ps(d) {
            var cmd = 'powershell -NoProfile -Command "$x=Get-CimInstance Win32_LogicalDisk -Filter \\\\"DeviceID=\\'' + d + ':\\'\\\\"; if($x){[string]$x.FreeSpace+\\' \\'+[string]$x.Size}"';
            _cp.exec(cmd, function (e, so) {
                if (!e && so && so.trim()) {
                    var p = so.trim().split(/\\s+/), f = parseInt(p[0]), t = parseInt(p[1]);
                    if (!isNaN(f) && !isNaN(t)) { resolve({ total: t, free: f, available: f }); return; }
                }
                resolve({ total: 0, free: 0, available: 0 });
            });
        }
        var drivePath = driveLetter + ':\\\\';
        if (typeof _fs.statfs === 'function') {
            _fs.statfs(drivePath, function (err, st) {
                if (!err && st) { var total = st.blocks * st.bsize, avail = st.bavail * st.bsize; resolve({ total: total, free: avail, available: avail }); }
                else { _ps(driveLetter); }
            });
        } else { _ps(driveLetter); }
    });
}`;

function patchFileUtil(src) {
  const out = replaceFunction(src, 'getWindowsDiskSpace', NEW_DISK_FN);
  if (!out) die('FileUtil.js 中未找到 getWindowsDiskSpace —— 该版本不被支持，请按附录B手动处理。');
  return out;
}

function patchMain(src, relative) {
  let s = src, changed = 0;
  if (!relative) return { src: s, changed };

  // ② initGameState：盘符判定恒不命中 'C'（'C' -> 'Z'），使 gameDir 默认取 getAppPath()
  const reC = /==\s*'C'\s*\)\s*\{/g, reZ = /==\s*'Z'\s*\)\s*\{/g;
  const nC = (s.match(reC) || []).length, nZ = (s.match(reZ) || []).length;
  if (nC === 1) { s = s.replace(reC, m => m.replace("'C'", "'Z'")); changed += 1; }
  else if (nC === 0 && nZ >= 1) { info('  · initGameState 已是相对路径补丁，跳过'); }
  else die("main.js 中 initGameState 盘符判定模式命中 " + nC + " 处（期望 1），该版本不被支持，请按附录B手动处理。");

  // ③④ 关闭两处 "C盘特判"
  const n0 = s.split("'C:')==0x0").length - 1, n9 = s.split("'C:')==0x9").length - 1;
  if (n0 >= 1) { s = s.split("'C:')==0x0").join("'C:')==0x9"); changed += n0; }
  else if (n9 >= 1) { info('  · C盘特判 已关闭，跳过'); }
  else die('main.js 中未找到 "C盘特判" 模式，该版本不被支持，请按附录B手动处理。');

  return { src: s, changed };
}

// ---------- 4. 重建 asar ----------
function buildAsar(asar, patched /* {path: Buffer} */) {
  const files = collectFiles(asar.header, asar.contentBase);
  const chunks = [];
  let cursor = 0;
  for (const f of files) {
    let content = patched[f.p] || getContent(asar, f.node);
    f.node.offset = String(cursor);
    f.node.size = content.length;
    if (patched[f.p]) f.node.integrity = integrityOf(content); // 改过的文件重算 integrity
    chunks.push(content);
    cursor += content.length;
  }
  const json = Buffer.from(JSON.stringify(asar.header), 'utf8');
  const L = json.length, P = (4 - (L % 4)) % 4;
  const head = Buffer.alloc(16);
  head.writeUInt32LE(4, 0);
  head.writeUInt32LE(8 + L + P, 4);
  head.writeUInt32LE(4 + L + P, 8);
  head.writeUInt32LE(L, 12);
  return Buffer.concat([head, json, Buffer.alloc(P), Buffer.concat(chunks)]);
}

// ---------- main ----------
(function main() {
  const RELATIVE = process.env.SEER_RELATIVE !== '0'; // 默认走启动器相对路径；设 0 则只去 wmic、保留默认 AppData 安装
  info('==== SeerLauncher 通用补丁器 ====');
  const dir = findInstallDir();
  if (!dir) die('未找到 SeerLauncher 安装目录。请确认已把“通用补丁器”整个文件夹放进 SeerLauncher 安装目录内；或手动指定：node seer_patch.js "D:\\路径\\SeerLauncher"');
  info('安装目录: ' + dir);
  const asarPath = path.join(dir, 'resources', 'app.asar');

  const asar = readAsar(asarPath);
  const files = collectFiles(asar.header, asar.contentBase);
  const byPath = {}; for (const f of files) byPath[f.p] = f;
  if (!byPath['main.js'] || !byPath['lib/FileUtil.js']) die('app.asar 结构异常（缺 main.js 或 lib/FileUtil.js）。');

  const fuSrc = getContent(asar, byPath['lib/FileUtil.js'].node).toString('utf8');
  const mjSrc = getContent(asar, byPath['main.js'].node).toString('utf8');

  const fuNew = patchFileUtil(fuSrc);
  const fuChanged = fuNew !== fuSrc;
  info(fuChanged ? '· FileUtil.js 已修补（去 wmic）' : '· FileUtil.js 无需改动');

  const mj = patchMain(mjSrc, RELATIVE);
  const mjChanged = mj.src !== mjSrc;
  info(mjChanged ? ('· main.js 已修补（命中 ' + mj.changed + ' 处）') : '· main.js 无需改动');

  if (!fuChanged && !mjChanged) { info('\n✔ 当前 app.asar 已是补丁版本，无需改动。'); return; }

  // 语法自检
  try { new Function(fuNew); } catch (e) { die('FileUtil.js 补丁语法错误: ' + e.message); }

  const patched = {};
  if (fuChanged) patched['lib/FileUtil.js'] = Buffer.from(fuNew, 'utf8');
  if (mjChanged) patched['main.js'] = Buffer.from(mj.src, 'utf8');
  const out = buildAsar(asar, patched);

  // 备份 + 写入
  const bak = asarPath + '.bak';
  if (!fs.existsSync(bak)) { fs.copyFileSync(asarPath, bak); info('已备份原文件 -> ' + bak); }
  else info('备份已存在，跳过（保留最初原版 .bak）');
  fs.writeFileSync(asarPath, out);
  info('已写入补丁后的 app.asar');

  // 相对路径安装会写入 <安装目录>\Games | \Download；若安装目录在 Program Files，需运行时管理员权限
  if (RELATIVE && /\\Program Files( \(x86\))?\\/i.test(dir + '\\')) {
    let exe = path.join(dir, 'SeerLauncher.exe');
    if (!fs.existsSync(exe)) {
      const cand = fs.readdirSync(dir).find(f => /\.exe$/i.test(f) && !/^(uninst|elevate)/i.test(f));
      exe = cand ? path.join(dir, cand) : null;
    }
    if (exe) {
      try {
        execSync('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers" /v "' + exe + '" /t REG_SZ /d "~ RUNASADMIN" /f', { stdio: 'ignore' });
        info('已设置：启动器始终以管理员运行（安装目录在 Program Files，需写入权限）');
      } catch (e) {
        info('提示：未能自动设置“管理员运行”，请右键 ' + exe + ' →属性→兼容性→勾选“以管理员身份运行此程序”。');
      }
    }
  } else if (RELATIVE) {
    info('安装目录可写，普通权限即可，无需管理员运行。');
  }

  info('\n✔ 完成。游戏将安装到: ' + path.join(dir, 'Games', 'NewSeer'));
  info('  下载包临时位于: ' + path.join(dir, 'Download'));
})();
