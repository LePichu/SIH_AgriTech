$scriptRoot = $PSScriptRoot

$outputFile = Join-Path $scriptRoot "build/context.txt"

$sourceFiles = @(
    "./IDENTITY.md",
    "./INSTRUCTIONS.md",
    "./data.json"
) | ForEach-Object { Join-Path $scriptRoot $_ }

$contentBlocks = $sourceFiles | ForEach-Object {
    $content = Get-Content -Path $_ -Raw
    if ($_.EndsWith(".json")) {
        '```json' + "`n" + $content + "`n" + '```'
    } else {
        $content
    }
}

New-Item -Path (Split-Path $outputFile) -ItemType Directory -Force -ErrorAction SilentlyContinue

$finalContent = $contentBlocks -join "`n`n"
Set-Content -Path $outputFile -Value $finalContent -Encoding utf8

Write-Host "Generated: $outputFile"