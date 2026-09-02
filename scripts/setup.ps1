# ==============================================================================
# AIRSPACE Workspace Setup Script (PowerShell)
# Installs dependencies, sets up environments, and checks imports.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "    AIRSPACE Monorepo Setup and Dependency Install" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Environment Variables Configurations
Write-Host "`n[1/4] Copying environment templates..." -ForegroundColor Yellow
$EnvFiles = @(
    @{ Src = ".env.example"; Dest = ".env" },
    @{ Src = "apps/backend/.env.example"; Dest = "apps/backend/.env" },
    @{ Src = "apps/frontend/.env.example"; Dest = "apps/frontend/.env" }
)

foreach ($File in $EnvFiles) {
    if (-not (Test-Path $File.Dest)) {
        Copy-Item $File.Src $File.Dest
        Write-Host "  -> Created: $($File.Dest)" -ForegroundColor Gray
    } else {
        Write-Host "  -> Exists: $($File.Dest) (Skipping)" -ForegroundColor Gray
    }
}

# 2. Python Virtual Environment Setup
Write-Host "`n[2/4] Initializing Python Virtual Environment (.venv)..." -ForegroundColor Yellow
if (-not (Test-Path ".venv")) {
    Write-Host "  Creating venv..." -ForegroundColor Gray
    python -m venv .venv
    Write-Host "  -> Created .venv" -ForegroundColor Green
} else {
    Write-Host "  -> .venv already exists (Skipping creation)" -ForegroundColor Gray
}

# Find pip and python executables (Windows specific paths)
$PipExe = Join-Path (Get-Location) ".venv\Scripts\pip.exe"
$PythonExe = Join-Path (Get-Location) ".venv\Scripts\python.exe"

if (-not (Test-Path $PipExe)) {
    Write-Error "Could not locate pip.exe in .venv/Scripts/"
    Exit 1
}

# Upgrade pip
Write-Host "  Upgrading pip..." -ForegroundColor Gray
& $PythonExe -m pip install --upgrade pip

# Install dependencies and link packages
Write-Host "  Installing dependencies and linking cv & ai packages..." -ForegroundColor Gray
Push-Location apps/backend
try {
    & $PipExe install -r requirements.txt
} finally {
    Pop-Location
}

# 3. Frontend Node Setup
Write-Host "`n[3/4] Installing Next.js Node dependencies..." -ForegroundColor Yellow
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Push-Location apps/frontend
    try {
        Write-Host "  Running npm install in apps/frontend..." -ForegroundColor Gray
        npm install
        Write-Host "  -> Next.js dependencies installed successfully." -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Warning "npm not found. Please install Node.js to run the frontend app."
}

# 4. Verify Local Modules Linkage
Write-Host "`n[4/4] Verifying monorepo package resolution..." -ForegroundColor Yellow
try {
    $TestOutput = & $PythonExe -c "import cv_core; import ai_core; print('SUCCESS')"
    if ($TestOutput -eq "SUCCESS") {
        Write-Host "  -> [OK] cv_core and ai_core packages successfully resolved!" -ForegroundColor Green
    } else {
        Write-Warning "Package import did not output success. Check link state."
    }
} catch {
    Write-Error "Failed to import cv_core or ai_core modules. Verify setups."
}

Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "    AIRSPACE Setup Complete! Setup is verified." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
