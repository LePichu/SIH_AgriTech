$scriptRoot = $PSScriptRoot

$processes = @(
	@{
		FilePath     = "deno"
		ArgumentList = "run -A `"$($(Join-Path $scriptRoot 'api/server.ts'))`""
	},
	@{
		FilePath     = "llama-server"
		ArgumentList = "-m `"$($(Join-Path $scriptRoot 'model/bin/llava-llama-3-8b-v1_1-int4.gguf'))`" --host 127.0.0.1 --port 3000 --n-gpu-layers 32 --chat-template llama3 --temp 0.1 --ctx-size 4096 --repeat-penalty 1.1 --top-k 40 --top-p 0.9 --mmproj `"$($(Join-Path $scriptRoot 'model/bin/llava-llama-3-8b-v1_1-mmproj-f16.gguf'))`""
	},
	@{
		FilePath     = "whisper-server"
		ArgumentList = "-m `"$($(Join-Path $scriptRoot 'model/bin/ggml-medium.en.bin'))`" --host 0.0.0.0 --port 8081 --convert"
	},
	@{
		FilePath     = "pnpm"
		ArgumentList = "--filter @helios/ui dev"
	}
)

$processes | ForEach-Object {
	Start-Process @_
}