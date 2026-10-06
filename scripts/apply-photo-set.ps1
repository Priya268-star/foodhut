<#
.SYNOPSIS
    Applies a chosen set of downloaded photographs to the correct dishes and covers.

.DESCRIPTION
    `fetch-dish-images.mts` finds *some* free photo for each dish; it cannot tell
    a good one from a bad one, because Commons' search index is semantic and will
    happily return a Big Mac for "cheeseburger". This script is the manual
    override: a hand-checked mapping from a downloaded file to the slug it is
    meant to illustrate, applied over whatever the fetcher chose.

    Two rules it enforces
    ---------------------
    * Licence is recorded as what it actually is. These files come from
      Unsplash, whose licence is not Creative Commons - it permits free
      commercial use and does not require attribution. Labelling them "CC BY"
      would be a false statement about someone's photograph, so they are stored
      as "Unsplash License" with the photographer taken from the filename
      (`<photographer>-<id>-unsplash.jpg`) and the canonical page recorded.

    * It reports every slug that was previously a generated placeholder, because
      those are referenced by a `.svg` path stored in Firestore and that cannot
      be corrected here without write access to the database.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/apply-photo-set.ps1
#>
[CmdletBinding()]
param(
    [string]$SourceDir = "$env:USERPROFILE\Downloads",
    [int]$MaxEdge = 1400,
    [int]$Quality = 85
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dishDir = Join-Path $root 'public\dishes'
$manifestPath = Join-Path $root 'emulator-data/images.json'

# source file (without the -unsplash suffix) -> slug it illustrates
$MAPPING = [ordered]@{
    # burgers
    'amirali-mirhashemian-sc5sTPMrVfk' = 'classic-smash-burger'
    # coffee
    'angie-baongoc-dRYUZtJb6j8'        = 'filter-coffee'
    # an extra dessert, added as a new dish rather than forced onto another name
    'camila-melim-yHQfZ9TuZn4'         = 'strawberry-sundae'
    # restaurant cover
    'ivan-torres-MQUqbmszGGM'          = 'cover-pizza-pasta'
    # the one dessert slot: the dish gets renamed to match the photo
    'jacob-thomas-6jHpcBPw7i8'         = 'tiramisu'
    'mario-raj-n1z3gc9gJ8I'            = 'hyderabadi-dum-biryani'
    # a restaurant cover that was previously a generated placeholder
    'nadine-primeau--ftWfohtjNw'       = 'cover-healthy-bowl'
    'nadine-primeau-yRLCgB_BoAM'        = 'quinoa-rainbow-bowl'
    'zoshua-colah-YNMLJcE9sdk'         = 'cover-north-indian'
    'zoshua-colah-_JvzS0ZX17Q'         = 'cover-south-indian'
}

$UNSPLASH_LICENCE = 'Unsplash License'

# Labels for slugs the manifest has never seen, i.e. dishes added to match a
# photograph rather than the other way round.
$NEW_LABELS = @{
    'strawberry-sundae' = 'Strawberry Sundae'
}

function Save-ResizedJpeg {
    param([string]$Source, [string]$Destination)
    $img = [System.Drawing.Image]::FromFile($Source)
    try {
        $longest = [Math]::Max($img.Width, $img.Height)
        $scale = if ($longest -gt $MaxEdge) { $MaxEdge / $longest } else { 1.0 }
        $w = [Math]::Max(1, [int][Math]::Round($img.Width * $scale))
        $h = [Math]::Max(1, [int][Math]::Round($img.Height * $scale))
        $flat = New-Object System.Drawing.Bitmap($w, $h)
        try {
            $g = [System.Drawing.Graphics]::FromImage($flat)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.Clear([System.Drawing.Color]::White)
                $g.DrawImage($img, 0, 0, $w, $h)
            }
            finally { $g.Dispose() }
            $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
                Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
            $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
            $flat.Save($Destination, $codec, $params)
        }
        finally { $flat.Dispose() }
        return @($w, $h)
    }
    finally { $img.Dispose() }
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

# Which slugs are currently generated placeholders? Those still point at a .svg
# in Firestore and will 404 until that path is corrected there.
$wasPlaceholder = @{}
foreach ($bucket in @($manifest.dishes, $manifest.covers)) {
    foreach ($p in $bucket.PSObject.Properties) {
        if ($p.Value.placeholder -eq $true) { $wasPlaceholder[$p.Name] = $true }
    }
}

$applied = @()
$missing = @()
$needsFirestore = @()

foreach ($sourceBase in $MAPPING.Keys) {
    $slug = $MAPPING[$sourceBase]
    $source = Join-Path $SourceDir "$sourceBase-unsplash.jpg"
    $dest = Join-Path $dishDir "$slug.jpg"

    if (-not (Test-Path $source)) { $missing += $sourceBase; continue }

    # `<photographer>-<photoId>` -> photographer, id. The username may itself
    # contain hyphens ("amirali-mirhashemian"), so only the final segment is the
    # photo id and everything before it belongs to the photographer.
    $parts = $sourceBase -split '-'
    $photoId = $parts[-1]
    $photographer = (($parts[0..($parts.Count - 2)]) -join '-').TrimEnd('-')
    $page = "https://unsplash.com/photos/$photoId"

    $beforeKb = [Math]::Round((Get-Item $source).Length / 1KB)
    $dims = Save-ResizedJpeg -Source $source -Destination $dest
    $afterKb = [Math]::Round((Get-Item $dest).Length / 1KB)

    # A stale .svg placeholder for this slug must not survive: the dish will now
    # reference the .jpg, and an unreferenced .svg is dead weight in every deploy.
    $staleSvg = Join-Path $dishDir "$slug.svg"
    if (Test-Path $staleSvg) { Remove-Item $staleSvg }

    $recorded = $false
    foreach ($bucket in @($manifest.dishes, $manifest.covers)) {
        if ($bucket.PSObject.Properties.Name -contains $slug) {
            $entry = $bucket.$slug
            $entry.file = "dishes/$slug.jpg"
            $entry | Add-Member -NotePropertyName 'licence' -NotePropertyValue $UNSPLASH_LICENCE -Force
            $entry | Add-Member -NotePropertyName 'author' -NotePropertyValue "@$photographer (Unsplash)" -Force
            $entry | Add-Member -NotePropertyName 'page' -NotePropertyValue $page -Force
            $entry | Add-Member -NotePropertyName 'title' -NotePropertyValue "$sourceBase (Unsplash)" -Force
            $entry.PSObject.Properties.Remove('placeholder')
            $recorded = $true
        }
    }
    if (-not $recorded -and $NEW_LABELS.ContainsKey($slug)) {
        # A dish added to match a photograph: register it so the credits page
        # and the verifier both know about it.
        $manifest.dishes | Add-Member -NotePropertyName $slug -NotePropertyValue ([PSCustomObject]@{
            file     = "dishes/$slug.jpg"
            licence  = $UNSPLASH_LICENCE
            author   = "@$photographer (Unsplash)"
            page     = $page
            title    = "$sourceBase (Unsplash)"
        }) -Force
        $recorded = $true
        Write-Output ("  new     {0,-26} -> {1}  (manifest entry created)" -f $sourceBase, $slug)
    }

    if (-not $recorded) {
        Write-Output ("  ? {0,-26} -> {1}: no manifest entry yet (new dish)" -f $sourceBase, $slug)
    }

    $applied += [PSCustomObject]@{
        slug = $slug; source = $sourceBase
        from = $beforeKb; to = $afterKb
        size = "$($dims[0])x$($dims[1])"
        placeholderBefore = $wasPlaceholder.ContainsKey($slug)
    }

    Write-Output ("  ok {0,-26} -> {1,-24} {2}  {3} KB -> {4} KB" -f $sourceBase, $slug, ($dims -join 'x'), $beforeKb, $afterKb)
}

$json = $manifest | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ''
Write-Output ("applied {0}   missing source files {1}" -f $applied.Count, $missing.Count)
if ($missing.Count) { $missing | ForEach-Object { Write-Output "  MISSING: $_-unsplash.jpg" } }

$needsFirestore = $applied | Where-Object { $_.placeholderBefore }
if ($needsFirestore) {
    Write-Output ''
    Write-Output 'FIRESTORE PATHS TO UPDATE (.svg -> .jpg):'
    foreach ($n in $needsFirestore) { Write-Output ("  {0}  (was a generated placeholder)" -f $n.slug) }
}

Write-Output ''
Write-Output 'New slugs with no manifest entry yet:'
foreach ($a in $applied) {
    $known = ($manifest.dishes.PSObject.Properties.Name -contains $a.slug) -or
             ($manifest.covers.PSObject.Properties.Name -contains $a.slug)
    if (-not $known) { Write-Output ("  {0}  <- {1}" -f $a.slug, $a.source) }
}