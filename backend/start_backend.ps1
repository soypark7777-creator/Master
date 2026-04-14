$ErrorActionPreference = "Stop"

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$depsPath = Join-Path $PSScriptRoot ".deps"
$defaultModelPath = Join-Path $PSScriptRoot "models\pose_landmarker_heavy.task"
$venvConfigPath = Join-Path $PSScriptRoot ".venv\pyvenv.cfg"
$useSystemPython = $false

if (-not (Test-Path $venvPython)) {
  try {
    Write-Host "Creating backend virtual environment..."
    py -m venv (Join-Path $PSScriptRoot ".venv")
  } catch {
    Write-Warning "Virtual environment creation failed. Falling back to system Python."
    $useSystemPython = $true
  }
}

if (Test-Path $venvConfigPath) {
  $venvConfig = Get-Content $venvConfigPath -Raw
  if ($venvConfig -match "include-system-site-packages = true") {
    Write-Warning "The backend venv was inheriting system site-packages. Switching it back to isolated mode."
    $venvConfig = $venvConfig -replace "include-system-site-packages = true", "include-system-site-packages = false"
    Set-Content -Path $venvConfigPath -Value $venvConfig -Encoding ascii
  }
}

$pythonCmd = if ($useSystemPython) { "py" } else { $venvPython }
$env:PYTHONPATH = if (Test-Path $depsPath) { "$depsPath;$PSScriptRoot\.." } else { "$PSScriptRoot\.." }
$env:PYTHONNOUSERSITE = "1"

try {
  & $pythonCmd -c "import flask, cv2, mediapipe, yt_dlp, dotenv"
  Write-Host "Backend dependencies already available."
} catch {
  Write-Host "Installing backend dependencies..."
  if (-not $useSystemPython) {
    try {
      & $pythonCmd -m pip install -r (Join-Path $PSScriptRoot "requirements.txt")
    } catch {
      Write-Warning "venv pip is unavailable. Falling back to system Python."
      $pythonCmd = "py"
      & $pythonCmd -m pip install -r (Join-Path $PSScriptRoot "requirements.txt")
    }
  } else {
    & $pythonCmd -m pip install -r (Join-Path $PSScriptRoot "requirements.txt")
  }
}

Write-Host "Starting Flask backend on http://127.0.0.1:5000 ..."
if (-not $env:MEDIAPIPE_POSE_MODEL_PATH -and (Test-Path $defaultModelPath)) {
  $env:MEDIAPIPE_POSE_MODEL_PATH = $defaultModelPath
}

if ($env:MEDIAPIPE_POSE_MODEL_PATH) {
  Write-Host "Pose model:" $env:MEDIAPIPE_POSE_MODEL_PATH
} else {
  Write-Warning "PoseLandmarker Heavy model path is not set. Add backend/models/pose_landmarker_heavy.task or set MEDIAPIPE_POSE_MODEL_PATH."
}

& $pythonCmd -m backend.app
