# ==============================================================================
# AIRSPACE Formatting and Linting Script (PowerShell)
# Usage:
#   ./scripts/format.ps1
# ==============================================================================

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "    AIRSPACE Code Formatter and Linter" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$PipExe = Join-Path (Get-Location) ".venv\Scripts\pip.exe"
$BlackExe = Join-Path (Get-Location) ".venv\Scripts\black.exe"
$IsortExe = Join-Path (Get-Location) ".venv\Scripts\isort.exe"

# Auto-install formatting tools if not present
if (-not (Test-Path $BlackExe) -or -not (Test-Path $IsortExe)) {
    Write-Host "Installing python formatting libraries (black, isort)..." -ForegroundColor Yellow
    & $PipExe install black isort
}

# Run formatters on Python folders
Write-Host "`n[1/2] Running Black and Isort on Python packages..." -ForegroundColor Yellow
Write-Host "  Formatting backend, cv, and ai packages..." -ForegroundColor Gray
& $BlackExe apps/backend packages/cv packages/ai
& $IsortExe apps/backend packages/cv packages/ai
Write-Host "  -> Python formatting complete." -ForegroundColor Green

# Run linter on Next.js frontend
Write-Host "`n[2/2] Running Next.js linter..." -ForegroundColor Yellow
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Push-Location apps/frontend
    try {
        npm run lint
    } catch {
        Write-Warning "Next.js linting run encountered warnings or errors."
    } finally {
        Pop-Location
    }
} else {
    Write-Warning "npm not found. Skipping Next.js lint check."
}

Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "    Formatting tasks complete." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
