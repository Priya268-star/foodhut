<#
.SYNOPSIS
    Takes photographs from drop-photos/ and puts them into the site.

.DESCRIPTION
    You drop images into drop-photos/, named after the dish or cover they
    illustrate (see drop-photos/README.md). This script then, for each one:

      * converts it to JPEG (PNG / WEBP / BMP / TIFF all work)
      * resizes it so the longest edge is at most MaxEdge, so the site stays fast
      * crops nothing - the app uses object-fit: cover, so the right part of the
        frame is shown anyway
      * writes it to public/dishes/<slug>.jpg
      * records it in emulator-data/images.json as `own: true`

    Why `own: true` matters
    -----------------------
    A photo you took needs no licence and no attribution, so it must not be
    listed among the Creative Commons downloads on the in-app credits page -
    crediting "unknown author, CC BY-SA 4.0" for your own photograph would be
    both wrong and, if the licence did not really apply, a legal problem. The
    fetcher only ever writes `licence`, so anything marked `own` is skipped by
    both the credits builder and the verifier.

    Anything you do not supply keeps whatever it already had.

.PARAMETER MaxEdge
    Longest-edge limit in pixels. 1400 is plenty for a full-width restaurant
    cover; dish thumbnails are displayed far smaller.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/apply-dropped-photos.ps1
#>
[CmdletBinding()]
param(
    [int]$MaxEdge = 1400,
    [int]$Quality = 85
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dropDir = Join-Path $root 'drop-photos'
$dishDir = Join-Path $root 'public\dishes'
$manifestPath = Join-Path $root 'emulator-data/images.json'

$readable = @('.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tif', '.tiff', '.webp')

if (-not (Test-Path $dropDir)) {
    Write-Output "No drop-photos folder yet at $dropDir"
    Write-Output "Create it and put photographs in, named after the dish."
    exit 0
}

$dropped = Get-ChildItem -Path $dropDir -File | Where-Object {
    $readable -contains $_.Extension.ToLower()
}

if (-not $dropped) {
    Write-Output "drop-photos/ is empty."
    Write-Output "Add .jpg or .png photographs named like 'butter-chicken.jpg'."
    Write-Output ""
    Write-Output "See drop-photos/README.md for the full list of names."
    exit 0
}

# Which slugs does the app currently serve as a generated placeholder? If one of
# those is replaced by a real photo the Firestore document still points at the
# .svg, and that cannot be fixed from here - no Admin SDK credentials - so it is
# called out loudly rather than shipped as a broken image.
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$placeholderSlugs = @()
foreach ($bucket in @($manifest.dishes, $manifest.covers)) {
    foreach ($p in $bucket.PSObject.Properties) {
        if ($p.Value.placeholder -eq $true) { $placeholderSlugs += $p.Name }
    }
}

New-Item -ItemType Directory -Force -Path $dishDir | Out-Null

function Save-ResizedJpeg {
    param([string]$Source, [string]$Destination)

    $img = [System.Drawing.Image]::FromFile($Source)
    try {
        $longest = [Math]::Max($img.Width, $img.Height)
        $scale = if ($longest -gt $MaxEdge) { $MaxEdge / $longest } else { 1.0 }
        $w = [Math]::Max(1, [int][Math]::Round($img.Width * $scale))
        $h = [Math]::Max(1, [int][Math]::Round($img.Height * $scale))

        # JPEG has no alpha channel; without this, transparency renders black.
        $flat = New-Object System.Drawing.Bitmap($w, $h)
        try {
            $g = [System.Drawing.Graphics]::FromImage($flat)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                # Flatten onto white: a PNG with an alpha channel is otherwise
                # written with a black background once the alpha is dropped.
                $g.Clear([System.Drawing.Color]::White)
                $g.DrawImage($img, 0, 0, $w, $h)
            }
            finally { $g.Dispose() }

            $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
                Where-Object { $_.MimeType -eq 'image/jpeg' } |
                Select-Object -First 1
            $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality
            )
            $flat.Save($Destination, $codec, $params)
        }
        finally { $flat.Dispose() }

        return @($w, $h)
    }
    finally { $img.Dispose() }
}

$applied = @()
$failed = @()

foreach ($file in $dropped) {
    $slug = $file.BaseName
    $dest = Join-Path $dishDir "$slug.jpg"

    try {
        $dims = Save-ResizedJpeg -Source $file.FullName -Destination $dest
        $beforeKb = [Math]::Round($file.Length / 1KB)
        $afterKb = [Math]::Round((Get-Item $dest).Length / 1KB)

        # Record it as the user's own photograph: no licence, no credit.
        $recorded = $false
        foreach ($bucket in @($manifest.dishes, $manifest.covers)) {
            if ($bucket.PSObject.Properties.Name -contains $slug) {
                $entry = $bucket.$slug
                $entry.file = "dishes/$slug.jpg"
                # A property that does not exist yet cannot be assigned to on a
                # PSCustomObject, so `own` is added explicitly.
                $entry | Add-Member -NotePropertyName 'own' -NotePropertyValue $true -Force
                # Clear the download metadata so a stale credit cannot linger.
                $entry.PSObject.Properties.Remove('title')
                $entry.PSObject.Properties.Remove('licence')
                $entry.PSObject.Properties.Remove('author')
                $entry.PSObject.Properties.Remove('source')
                $entry.PSObject.Properties.Remove('page')
                $entry.PSObject.Properties.Remove('placeholder')
                $recorded = $true
            }
        }
        if (-not $recorded) {
            # A photograph for something the app does not use: kept out of the
            # manifest, but the file is left in place in case it is a typo of an
            # existing slug worth checking by hand.
            Write-Output ("  ? {0,-30} not a known dish/cover slug - copied but not registered" -f $slug)
        }

        $applied += [PSCustomObject]@{
            slug = $slug
            from = $beforeKb
            to = $afterKb
            size = "$($dims[0])x$($dims[1])"
        }

        Write-Output ("  ok {0,-30} {1}x{2}  {3} KB -> {4} KB" -f $slug, $dims[0], $dims[1], $beforeKb, $afterKb)
    }
    catch {
        $failed += $slug
        Write-Output ("  FAILED {0}: {1}" -f $slug, $_.Exception.Message)
    }
}

$json = $manifest | ConvertTo-Json -Depth 10

# Windows PowerShell's `Set-Content -Encoding UTF8` writes a BOM, and `JSON.parse`
# in Node rejects one outright - the whole manifest would become unreadable. The
# rest of this repo reads that file with readFileSync, so it is written here the
# same way: UTF-8, no BOM.
[System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ''
Write-Output ("applied: {0}   failed: {1}" -f $applied.Count, $failed.Count)

$needsFirestore = $applied | Where-Object { $_.slug -in $placeholderSlugs }
if ($needsFirestore) {
    Write-Output ''
    Write-Output 'NOTE: these were previously generated placeholders, so Firestore'
    Write-Output '      still points at the old .svg and must be updated separately:'
    foreach ($n in $needsFirestore) { Write-Output ("      - {0}" -f $n.slug) }
}

Write-Output ''
Write-Output 'Next:  npm run images:verify  ->  npm run deploy:hosting'