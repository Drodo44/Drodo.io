!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing Drodo automation dependencies..."

  IfFileExists "$INSTDIR\_up_\scripts\install-dependencies.ps1" +3 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Drodo could not find its dependency bootstrap script after installation. You can still use Drodo, but workflow automation may not be available until dependencies are installed."
    Goto drodo_postinstall_done

  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("DRODO_AUTOMATION_HOME", "$INSTDIR\automation").r0'
  DetailPrint "Installing automation dependencies (Node.js, Git, n8n) — this may take a few minutes..."
  nsExec::Exec /TIMEOUT=600000 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\_up_\scripts\install-dependencies.ps1"'
  Pop $0

  StrCmp $0 "0" drodo_postinstall_done

  StrCpy $1 "BootstrapFailure"
  IfFileExists "$INSTDIR\automation\last-error.txt" 0 +4
    FileOpen $2 "$INSTDIR\automation\last-error.txt" r
    FileRead $2 $1
    FileClose $2

  MessageBox MB_OK|MB_ICONEXCLAMATION "Drodo could not finish installing automation dependencies (Node.js, Git, n8n). Reason: $1 See $INSTDIR\automation\logs\bootstrap.log for details."

drodo_postinstall_done:
!macroend
