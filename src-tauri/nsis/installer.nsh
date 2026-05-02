!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing Drodo automation dependencies..."

  IfFileExists "$INSTDIR\_up_\scripts\install-dependencies.ps1" +3 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Drodo could not find its dependency bootstrap script after installation. You can still use Drodo, but workflow automation may not be available until dependencies are installed."
    Goto drodo_postinstall_done

  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("DRODO_AUTOMATION_HOME", "$APPDATA\Drodo\n8n").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i("DRODO_BUNDLED_RUNTIME_DIR", "$INSTDIR\_up_\artifacts\runtime").r0'
  DetailPrint "Installing automation dependencies (Node.js, Git, n8n) — this may take a few minutes..."
  nsExec::Exec /TIMEOUT=600000 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\_up_\scripts\install-dependencies.ps1"'
  Pop $0

  StrCmp $0 "0" drodo_postinstall_done
  DetailPrint "Automation setup will complete on first launch."
  Goto drodo_postinstall_done

drodo_postinstall_done:
!macroend
