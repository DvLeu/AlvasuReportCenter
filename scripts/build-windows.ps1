$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"
$Electron = Join-Path $Root "electron"
$Venv = Join-Path $Backend ".venv"
$Python = Join-Path $Venv "Scripts\python.exe"

Write-Host "Building frontend..."
Push-Location $Frontend
npm install
npm run build
Pop-Location

Write-Host "Preparing Python backend..."
Push-Location $Backend
if (-not (Test-Path $Python)) {
    py -3 -m venv .venv
}
& $Python -m pip install --upgrade pip
& $Python -m pip install -r requirements.txt pyinstaller
& $Python -m PyInstaller --noconfirm --clean --onefile --name aguas-backend app.py
Pop-Location

Write-Host "Building Windows installer..."
Push-Location $Electron
npm install
npm run dist:win
Pop-Location

Write-Host "Installer ready in electron\dist"
