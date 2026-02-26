# Quick Docker Commands
# Usage: .\docker.ps1 <command>
# Example: .\docker.ps1 start

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "🐳 Fitz Net Website - Docker Commands" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\docker.ps1 <command>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor Green
    Write-Host "  build     - Build the Docker image"
    Write-Host "  start     - Start the container"
    Write-Host "  stop      - Stop the container"
    Write-Host "  restart   - Restart the container"
    Write-Host "  rebuild   - Rebuild and restart"
    Write-Host "  logs      - View container logs"
    Write-Host "  status    - Show container status"
    Write-Host "  shell     - Open shell in container"
    Write-Host "  clean     - Remove container and image"
    Write-Host "  help      - Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\docker.ps1 start"
    Write-Host "  .\docker.ps1 logs"
    Write-Host "  .\docker.ps1 rebuild"
}

switch ($Command.ToLower()) {
    "build" {
        Write-Host "🔨 Building Docker image..." -ForegroundColor Green
        docker-compose build
    }
    "start" {
        Write-Host "🚀 Starting container..." -ForegroundColor Green
        docker-compose up -d
        Write-Host "✅ Container started at http://localhost:3000" -ForegroundColor Green
    }
    "stop" {
        Write-Host "🛑 Stopping container..." -ForegroundColor Yellow
        docker-compose down
    }
    "restart" {
        Write-Host "🔄 Restarting container..." -ForegroundColor Green
        docker-compose restart
    }
    "rebuild" {
        Write-Host "🔄 Rebuilding and restarting..." -ForegroundColor Green
        docker-compose down
        docker-compose up -d --build
        Write-Host "✅ Container rebuilt at http://localhost:3000" -ForegroundColor Green
    }
    "logs" {
        Write-Host "📋 Showing logs (Ctrl+C to exit)..." -ForegroundColor Cyan
        docker-compose logs -f fitz-net-website
    }
    "status" {
        Write-Host "📊 Container Status:" -ForegroundColor Cyan
        docker-compose ps
        docker inspect --format='{{.State.Health.Status}}' fitz-net-website 2>$null
    }
    "shell" {
        Write-Host "🐚 Opening shell in container..." -ForegroundColor Cyan
        docker exec -it fitz-net-website sh
    }
    "clean" {
        Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow
        docker-compose down --rmi all -v
        Write-Host "✅ Cleanup complete!" -ForegroundColor Green
    }
    "help" {
        Show-Help
    }
    default {
        Write-Host "❌ Unknown command: $Command" -ForegroundColor Red
        Write-Host ""
        Show-Help
        exit 1
    }
}

