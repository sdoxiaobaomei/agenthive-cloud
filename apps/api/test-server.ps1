# Test script to start API server and verify it's working
$env:LLM_PROVIDER = "ollama"
$env:OLLAMA_MODEL = "qwen3:14b"
$env:WORKSPACE_BASE = "./data/workspaces"
$env:PORT = "3001"

Write-Host "Starting API Server..."
Write-Host "LLM Provider: $env:LLM_PROVIDER"
Write-Host "Model: $env:OLLAMA_MODEL"

# Start server in background
$job = Start-Job { 
    Set-Location $using:PWD
    npx tsx src/index.ts 
}

# Wait for server to start
Write-Host "Waiting for server to start..."
Start-Sleep 10

# Test health endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5
    Write-Host "✅ API Server is running!"
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "❌ Failed to connect to API Server"
    Write-Host $_.Exception.Message
}

# Show job output
Receive-Job $job

# Keep running
Write-Host "Server is running. Press Ctrl+C to stop."
while ($job.State -eq "Running") {
    Start-Sleep 1
    Receive-Job $job
}
