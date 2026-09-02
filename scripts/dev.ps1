# ==============================================================================
# AIRSPACE Dev Execution Orchestrator (PowerShell)
# Usage:
#   ./scripts/dev.ps1 -Service Db       # Starts Postgres DB Container
#   ./scripts/dev.ps1 -Service Backend  # Runs FastAPI App
#   ./scripts/dev.ps1 -Service Frontend # Runs Next.js App
#   ./scripts/dev.ps1 -Service All      # Runs everything (Docker DB + new shells for apps)
# ==============================================================================

param (
    [Parameter(Position = 0)]
    [ValidateSet("Db", "Backend", "Frontend", "All")]
    [string]$Service = "All"
)

$UvicornPath = Join-Path (Get-Location) ".venv\Scripts\uvicorn.exe"

switch ($Service) {
    "Db" {
        Write-Host "Starting PostgreSQL container via docker-compose..." -ForegroundColor Yellow
        docker-compose up -d db
        Write-Host "[OK] Database container is starting up." -ForegroundColor Green
    }
    "Backend" {
        if (-not (Test-Path $UvicornPath)) {
            Write-Error "Uvicorn not found in .venv/Scripts/. Run ./scripts/setup.ps1 first."
            Exit 1
        }
        Write-Host "Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
        Push-Location apps/backend
        try {
            & $UvicornPath main:app --reload --port 8000
        } finally {
            Pop-Location
        }
    }
    "Frontend" {
        Write-Host "Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Yellow
        Push-Location apps/frontend
        try {
            npm run dev
        } finally {
            Pop-Location
        }
    }
    "All" {
        Write-Host "=================================================" -ForegroundColor Cyan
        Write-Host "    Bootstrapping Complete AIRSPACE Stack" -ForegroundColor Cyan
        Write-Host "=================================================" -ForegroundColor Cyan
        
        Write-Host "`n[1/3] Spinning up PostgreSQL..." -ForegroundColor Yellow
        docker-compose up -d db
        
        Write-Host "`n[2/3] Launching FastAPI Backend in new window..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting FastAPI Backend...'; cd apps/backend; ../../.venv/Scripts/uvicorn main:app --reload --port 8000"
        
        Write-Host "`n[3/3] Launching Next.js Frontend in new window..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Next.js Frontend...'; cd apps/frontend; npm run dev"
        
        Write-Host "`nAll processes initiated. Check independent shell windows for details." -ForegroundColor Green
    }
}
