param(
    [Parameter(Mandatory=$true)][string]$InputGltf,
    [Parameter(Mandatory=$true)][string]$OutputGlb
)

$ErrorActionPreference = 'Stop'
$doc = Get-Content -Raw -LiteralPath $InputGltf | ConvertFrom-Json
$buffer64 = ([string]$doc.buffers[0].uri).Split(',',2)[1]
$bin = [Convert]::FromBase64String($buffer64)
$doc.buffers[0].PSObject.Properties.Remove('uri')

for ($i=0; $i -lt $doc.images.Count; $i++) {
    $uri = [string]$doc.images[$i].uri
    if ($uri -notmatch '^data:([^;]+);base64,(.+)$') { continue }
    $mime = $Matches[1]
    $imageBytes = [Convert]::FromBase64String($Matches[2])
    $padding = (4 - ($bin.Length % 4)) % 4
    $offset = $bin.Length + $padding
    $next = New-Object byte[] ($offset + $imageBytes.Length)
    [Array]::Copy($bin, 0, $next, 0, $bin.Length)
    [Array]::Copy($imageBytes, 0, $next, $offset, $imageBytes.Length)
    $bin = $next
    $viewIndex = $doc.bufferViews.Count
    $doc.bufferViews += [pscustomobject]@{ buffer=0; byteOffset=$offset; byteLength=$imageBytes.Length }
    $doc.images[$i].PSObject.Properties.Remove('uri')
    $doc.images[$i] | Add-Member -NotePropertyName bufferView -NotePropertyValue $viewIndex -Force
    $doc.images[$i] | Add-Member -NotePropertyName mimeType -NotePropertyValue $mime -Force
}

$doc.buffers[0].byteLength = $bin.Length
$jsonText = $doc | ConvertTo-Json -Depth 100 -Compress
$jsonBytes = [Text.Encoding]::UTF8.GetBytes($jsonText)
$jsonPadding = (4 - ($jsonBytes.Length % 4)) % 4
$binPadding = (4 - ($bin.Length % 4)) % 4
$jsonChunkLength = $jsonBytes.Length + $jsonPadding
$binChunkLength = $bin.Length + $binPadding
$totalLength = 12 + 8 + $jsonChunkLength + 8 + $binChunkLength

$stream = [IO.File]::Open($OutputGlb, [IO.FileMode]::Create, [IO.FileAccess]::Write)
$writer = New-Object IO.BinaryWriter($stream)
try {
    $writer.Write([uint32]0x46546C67)
    $writer.Write([uint32]2)
    $writer.Write([uint32]$totalLength)
    $writer.Write([uint32]$jsonChunkLength)
    $writer.Write([uint32]0x4E4F534A)
    $writer.Write($jsonBytes)
    for ($i=0; $i -lt $jsonPadding; $i++) { $writer.Write([byte]0x20) }
    $writer.Write([uint32]$binChunkLength)
    $writer.Write([uint32]0x004E4942)
    $writer.Write($bin)
    for ($i=0; $i -lt $binPadding; $i++) { $writer.Write([byte]0) }
} finally {
    $writer.Dispose()
    $stream.Dispose()
}
