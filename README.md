# seerlauncher-win11-fix

> 修复 **Windows 11 上赛尔号启动器(SeerLauncher)点「获取游戏」毫无反应**的问题。
> A one-click patcher that fixes SeerLauncher's unresponsive "Get Game" button on Windows 11.

启动器用已被 Win11 移除的 `wmic` 命令查磁盘空间,在只有 C 盘的机器上会导致游戏安装目录始终为空,随后点「获取游戏」的代码因空目录抛异常而中途崩溃——表现为按钮"没反应"。本工具**修改你本机自己的 `app.asar`**(而非替换成别人打包好的文件),因此能自动适配不同版本、不同安装位置。

---

## ✨ 特性

- **一键运行**:双击 `一键补丁.bat`,自动定位、备份、修补。
- **不含任何官方文件**:仓库里只有补丁脚本,不分发启动器/游戏的任何受版权内容;它只改你电脑上已有的文件。
- **幂等 & 版本自适应**:对已打补丁的 asar 再次运行会自动跳过;遇到不匹配的版本会安全中止,绝不写出损坏文件。
- **可还原**:自动备份原文件为 `app.asar.bak`。

修复后(默认):游戏安装到 `<启动器目录>\Games\NewSeer\`,下载包临时位于 `<启动器目录>\Download\`。

---

## 🚀 使用方法

### 前置要求
- 已安装 **[Node.js](https://nodejs.org)**(建议官方安装包,系统级安装)。
- 管理员权限(启动器一般装在 `Program Files`,放置文件夹与写文件都需要)。

### 步骤
1. 点本页右上角绿色 **`Code` → `Download ZIP`** 下载,解压。
2. 关闭赛尔号启动器,把**解压得到的文件夹整个**(里面有 `seer_patch.js`、`一键补丁.bat`)放进 **SeerLauncher 安装目录**内
   (如 `C:\Program Files (x86)\SeerLauncher\`;复制进 Program Files 会弹一次 UAC,点"继续")。文件夹叫什么名字都行。
3. 进入该文件夹,双击 **`一键补丁.bat`** → UAC 点"是"。
4. 看到 **`✔ 完成`** 即可。双击启动器(若设了管理员运行会再弹一次 UAC),点「获取游戏」。
5. 补丁已写入 `app.asar`,之后这个文件夹**可以删掉**。

> 补丁器靠"自己所在文件夹的上一级"定位安装目录,所以**务必把文件夹放进 SeerLauncher 目录里**。
> 装在非默认位置时,可手动指定:`node seer_patch.js "D:\你的路径\SeerLauncher"`。

---

## 🔧 它改了什么

只动 `app.asar` 里的两个文件:

- **`lib/FileUtil.js`** — `getWindowsDiskSpace` 弃用 `wmic`,改用 Node 原生 `fs.statfs`(+ PowerShell `Get-CimInstance` 兜底);缺盘符时返回 0 而非抛异常。
- **`main.js`** — 让游戏目录默认取启动器目录,并关闭"C盘特判重定向",使安装/下载走启动器相对路径。

完整的根因分析与逆向过程见 **[docs/技术分析.md](docs/技术分析.md)**。

---

## ♻️ 还原

1. 把 `<安装目录>\resources\app.asar.bak` 改回 `app.asar`;
2. 若脚本设过"管理员运行",删除注册表
   `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers` 下名为启动器 exe 路径的值。

---

## ❓ 常见问题

| 现象 | 处理 |
|---|---|
| `Node.js not found` | 先装 [Node.js](https://nodejs.org) 再重试 |
| "未找到安装目录" | 文件夹没放进 SeerLauncher 目录;或手动 `node seer_patch.js "安装目录"` |
| "该版本不被支持" | 启动器版本与内置模式不符,请参照 [docs/技术分析.md](docs/技术分析.md) 附录手动处理 |
| 打完仍需每次点 UAC | 启动器在 `Program Files`,写入权限所需;可改装到非系统盘目录免提权 |

进阶:只想修好"无响应"但保留官方默认 AppData 安装(无需管理员),先 `set SEER_RELATIVE=0` 再 `node seer_patch.js`。

---

## ⚠️ 免责声明

本工具仅用于修复**用户自有设备上、自行安装**的客户端,使其能在新系统正常运行,属个人学习与互操作性自救。
- 仓库**不包含**赛尔号 / SeerLauncher 的任何官方文件或资源,补丁器只在本地修改用户已安装的文件。
- 赛尔号及启动器版权归 **上海淘米网络科技有限公司** 所有,请支持正版。
- 修改客户端文件有风险,脚本已自动备份;如遇异常用 `app.asar.bak` 还原。使用本工具的风险由使用者自负。

## 📄 License

[MIT](LICENSE) — 仅覆盖本仓库自有代码,不授予对第三方软件的任何权利。
