$ErrorActionPreference = "Stop"

$venvPath = Join-Path $PSScriptRoot ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"
$venvConfigPath = Join-Path $venvPath "pyvenv.cfg"

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating isolated backend virtual environment..."
  py -m venv $venvPath
}

if (Test-Path $venvConfigPath) {
  $config = Get-Content $venvConfigPath -Raw
  if ($config -match "include-system-site-packages = true") {
    $config = $config -replace "include-system-site-packages = true", "include-system-site-packages = false"
    Set-Content -Path $venvConfigPath -Value $config -Encoding ascii
    Write-Host "Updated pyvenv.cfg to disable system site-packages."
  }
}

$env:PYTHONNOUSERSITE = "1"

Write-Host "Upgrading pip tooling..."
& $venvPython -m pip install --upgrade pip setuptools wheel

Write-Host "Reinstalling backend dependencies inside .venv ..."
& $venvPython -m pip install --force-reinstall -r (Join-Path $PSScriptRoot "requirements.txt")

Write-Host "Verifying numpy / mediapipe import ..."
& $venvPython -c "import numpy, mediapipe, sys; print({'python': sys.executable, 'numpy': numpy.__version__, 'mediapipe': getattr(mediapipe, '__version__', 'unknown')})"

Write-Host "Environment repair complete."
