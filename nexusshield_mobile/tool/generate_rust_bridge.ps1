# Generates flutter_rust_bridge bindings for rust_core/.
# Requires: Rust stable, Visual Studio Build Tools (link.exe), Flutter SDK.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command flutter_rust_bridge_codegen -ErrorAction SilentlyContinue)) {
  Write-Host "Installing flutter_rust_bridge_codegen via cargo..."
  cargo install flutter_rust_bridge_codegen --version 2.13.0
}

flutter_rust_bridge_codegen integrate --no-dart-format
flutter_rust_bridge_codegen generate
Write-Host "Done. Rebuild the app: flutter run"
