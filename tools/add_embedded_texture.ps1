param(
    [Parameter(Mandatory=$true)][string]$InputGltf,
    [Parameter(Mandatory=$true)][string]$TexturePng,
    [Parameter(Mandatory=$true)][string]$OutputGltf
)

$ErrorActionPreference = 'Stop'
$doc = Get-Content -Raw -LiteralPath $InputGltf | ConvertFrom-Json
$primitive = $doc.meshes[0].primitives[0]
$positionAccessorIndex = [int]$primitive.attributes.POSITION
$normalAccessorIndex = [int]$primitive.attributes.NORMAL
$positionAccessor = $doc.accessors[$positionAccessorIndex]
$normalAccessor = $doc.accessors[$normalAccessorIndex]
$positionView = $doc.bufferViews[[int]$positionAccessor.bufferView]
$normalView = $doc.bufferViews[[int]$normalAccessor.bufferView]

$bufferUri = [string]$doc.buffers[0].uri
$base64 = $bufferUri.Substring($bufferUri.IndexOf(',') + 1)
$buffer = [Convert]::FromBase64String($base64)
$vertexCount = [int]$positionAccessor.count

function Read-Float32([byte[]]$bytes, [int]$offset) {
    return [BitConverter]::ToSingle($bytes, $offset)
}

$min = @([double]$positionAccessor.min[0], [double]$positionAccessor.min[1], [double]$positionAccessor.min[2])
$max = @([double]$positionAccessor.max[0], [double]$positionAccessor.max[1], [double]$positionAccessor.max[2])
$range = @(($max[0]-$min[0]), ($max[1]-$min[1]), ($max[2]-$min[2]))
for ($i=0; $i -lt 3; $i++) { if ([Math]::Abs($range[$i]) -lt 1e-12) { $range[$i] = 1.0 } }

$uvBytes = New-Object byte[] ($vertexCount * 8)
for ($i=0; $i -lt $vertexCount; $i++) {
    $po = [int]$positionView.byteOffset + [int]$positionAccessor.byteOffset + $i * 12
    $no = [int]$normalView.byteOffset + [int]$normalAccessor.byteOffset + $i * 12
    $p = @((Read-Float32 $buffer $po), (Read-Float32 $buffer ($po+4)), (Read-Float32 $buffer ($po+8)))
    $n = @((Read-Float32 $buffer $no), (Read-Float32 $buffer ($no+4)), (Read-Float32 $buffer ($no+8)))
    $ax=[Math]::Abs($n[0]); $ay=[Math]::Abs($n[1]); $az=[Math]::Abs($n[2])
    if ($ay -ge $ax -and $ay -ge $az) {
        $u = ($p[0]-$min[0])/$range[0]; $v = ($p[2]-$min[2])/$range[2]
    } elseif ($ax -ge $az) {
        $u = ($p[2]-$min[2])/$range[2]; $v = ($p[1]-$min[1])/$range[1]
    } else {
        $u = ($p[0]-$min[0])/$range[0]; $v = ($p[1]-$min[1])/$range[1]
    }
    [BitConverter]::GetBytes([single]$u).CopyTo($uvBytes, $i*8)
    [BitConverter]::GetBytes([single]$v).CopyTo($uvBytes, $i*8+4)
}

$oldLength = $buffer.Length
$combined = New-Object byte[] ($oldLength + $uvBytes.Length)
[Array]::Copy($buffer, 0, $combined, 0, $oldLength)
[Array]::Copy($uvBytes, 0, $combined, $oldLength, $uvBytes.Length)
$doc.buffers[0].byteLength = $combined.Length
$doc.buffers[0].uri = 'data:application/octet-stream;base64,' + [Convert]::ToBase64String($combined)

$uvViewIndex = $doc.bufferViews.Count
$doc.bufferViews += [pscustomobject]@{ buffer=0; byteOffset=$oldLength; byteLength=$uvBytes.Length; target=34962 }
$uvAccessorIndex = $doc.accessors.Count
$doc.accessors += [pscustomobject]@{ bufferView=$uvViewIndex; componentType=5126; count=$vertexCount; type='VEC2'; min=@(0.0,0.0); max=@(1.0,1.0) }
$primitive.attributes | Add-Member -NotePropertyName 'TEXCOORD_0' -NotePropertyValue $uvAccessorIndex -Force

$textureData = [Convert]::ToBase64String([IO.File]::ReadAllBytes($TexturePng))
$doc | Add-Member -NotePropertyName images -NotePropertyValue @([pscustomobject]@{ name='Sandstone Albedo'; uri=('data:image/png;base64,'+$textureData) }) -Force
$doc | Add-Member -NotePropertyName samplers -NotePropertyValue @([pscustomobject]@{ magFilter=9729; minFilter=9987; wrapS=10497; wrapT=10497 }) -Force
$doc | Add-Member -NotePropertyName textures -NotePropertyValue @([pscustomobject]@{ name='Sandstone Texture'; sampler=0; source=0 }) -Force
$doc.materials[0].name = 'Sandstone Platform'
$doc.materials[0].pbrMetallicRoughness.baseColorFactor = @(1.0,1.0,1.0,1.0)
$doc.materials[0].pbrMetallicRoughness.metallicFactor = 0.0
$doc.materials[0].pbrMetallicRoughness.roughnessFactor = 0.82
$doc.materials[0].pbrMetallicRoughness | Add-Member -NotePropertyName baseColorTexture -NotePropertyValue ([pscustomobject]@{ index=0; texCoord=0 }) -Force
$doc | Add-Member -NotePropertyName extras -NotePropertyValue ([pscustomobject]@{ textureWorkflow='Generated box-projection UV because source FBX contained no exported TEXCOORD_0'; sourceModel='platform_source.fbx'; albedo='platform_sandstone_albedo.png' }) -Force

$json = $doc | ConvertTo-Json -Depth 100 -Compress
[IO.File]::WriteAllText($OutputGltf, $json, (New-Object Text.UTF8Encoding($false)))
