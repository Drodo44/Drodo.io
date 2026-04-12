!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing Drodo automation dependencies..."

  IfFileExists "$INSTDIR\_up_\scripts\install-dependencies.ps1" +3 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Drodo could not find its dependency bootstrap script after installation. You can still use Drodo, but workflow automation may not be available until dependencies are installed."
    Goto drodo_postinstall_done

  nsExec::Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\_up_\scripts\install-dependencies.ps1"'
  Pop $0

  StrCmp $0 "0" drodo_postinstall_done

  MessageBox MB_OK|MB_ICONEXCLAMATION "Drodo could not finish installing automation dependencies (Node.js, Git, n8n). You can still use Drodo, but workflow automation may not be available until setup completes successfully."

drodo_postinstall_done:
!macroend
