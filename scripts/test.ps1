# ==============================================================================
# AIRSPACE Test Execution Script (PowerShell)
# Orchestrates test running across the backend and internal modules.
# ==============================================================================

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "    AIRSPACE Monorepo Test Suites runner" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$PythonExe = Join-Path (Get-Location) ".venv\Scripts\python.exe"
$PytestExe = Join-Path (Get-Location) ".venv\Scripts\pytest.exe"

# Pre-execution environment validation
if (-not (Test-Path $PythonExe)) {
    Write-Error "Virtual environment not initialized. Run ./scripts/setup.ps1 first."
    Exit 1
}

# Auto-install pytest if it doesn't exist in the venv
if (-not (Test-Path $PytestExe)) {
    Write-Host "Installing pytest in virtual environment..." -ForegroundColor Yellow
    $PipExe = Join-Path (Get-Location) ".venv\Scripts\pip.exe"
    & $PipExe install pytest
}

# Run backend tests
Write-Host "`n[1/4] Executing Backend (FastAPI) tests..." -ForegroundColor Yellow
if (Test-Path "apps/backend/tests") {
    Push-Location apps/backend
    try {
        & $PythonExe -m pytest tests
    } finally {
        Pop-Location
    }
} else {
    Write-Host "  -> No backend tests folder found." -ForegroundColor Gray
}

# Run cv tests
Write-Host "`n[2/4] Executing CV Package tests..." -ForegroundColor Yellow
if (Test-Path "packages/cv/tests") {
    & $PythonExe -m pytest packages/cv/tests
} else {
    Write-Host "  -> No CV package tests folder found." -ForegroundColor Gray
}

# Run ai tests
Write-Host "`n[3/4] Executing AI Package tests..." -ForegroundColor Yellow
if (Test-Path "packages/ai/tests") {
    & $PythonExe -m pytest packages/ai/tests
} else {
    Write-Host "  -> No AI package tests folder found." -ForegroundColor Gray
}

# Run frontend tests
Write-Host "`n[4/4] Executing Frontend (Next.js) tests..." -ForegroundColor Yellow
if (Test-Path "apps/frontend") {
    Push-Location apps/frontend
    try {
        npm run test
    } finally {
        Pop-Location
    }
} else {
    Write-Host "  -> No frontend folder found." -ForegroundColor Gray
}

Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "    Verification test run complete." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
