$denoCmd = "deno run -A `"./api/server.ts`""
$llamaCmd = "llama-server -m `"./model/bin/llava-llama-3-8b-v1_1-int4.gguf`" --host 127.0.0.1 --port 3000 -ngl 32 --chat-template llama3 -c 8192 --mmproj `"./model/bin/llava-llama-3-8b-v1_1-mmproj-f16.gguf`""
$whisperCmd = "whisper-server -m `".//model/bin/ggml-medium.en.bin`" --host 0.0.0.0 --port 8081 --convert"
$pnpmCmd = "pnpm --filter @helios/ui dev"

$commands = @(
    $denoCmd,
    $llamaCmd,
    # $whisperCmd,
    $pnpmCmd
)

foreach ($command in $commands) {
    Start-Job -ScriptBlock {
        param($cmd)
        Invoke-Expression $cmd
    } -ArgumentList $command
}

Write-Host "✅ All servers have been launched in the background."
Write-Host "🖥️  Monitoring output... (Press CTRL+C to stop all)"

while ($true) {
    Get-Job | Receive-Job
    Start-Sleep -Seconds 1
}