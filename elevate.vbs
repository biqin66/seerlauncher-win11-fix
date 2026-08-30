If WScript.Arguments.Count < 1 Then
  WScript.Quit 1
End If
Set sh = CreateObject("Shell.Application")
sh.ShellExecute "cmd.exe", "/c call " & Chr(34) & WScript.Arguments(0) & Chr(34), "", "runas", 1
