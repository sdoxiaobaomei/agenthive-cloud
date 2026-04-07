# Start server and run test
$env:LLM_PROVIDER="ollama"
$env:OLLAMA_MODEL="qwen3:14b"
$env:PORT="3002"
$env:WORKSPACE_BASE="./workspaces"

# Start server in background
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npx tsx src/index.ts 2>&1
}

Write-Host "Starting server..."
Start-Sleep 10

Write-Host "`nRunning test...`n"
node test-hello.js

Write-Host "`nStopping server..."
Stop-Job $serverJob
Remove-Job $serverJob
