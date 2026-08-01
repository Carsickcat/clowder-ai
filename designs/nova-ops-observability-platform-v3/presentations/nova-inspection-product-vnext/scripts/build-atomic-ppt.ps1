param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\NOVA-Change-Inspection-Product-vNext.pptx')
)

$ErrorActionPreference = 'Stop'

$presentationDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$assetDir = Join-Path $presentationDir 'assets\vnext-atomic'
$slideFiles = @(
  'p1-journey.png',
  'p2-generation.png',
  'p3-orchestration.png',
  'p4-evidence.png',
  'p5-reports.png',
  'p6-assessment.png',
  'p7-interaction.png',
  'p8-roadmap.png'
)

foreach ($slideFile in $slideFiles) {
  $slidePath = Join-Path $assetDir $slideFile
  if (-not (Test-Path -LiteralPath $slidePath -PathType Leaf)) {
    throw "Missing slide asset: $slidePath"
  }
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$powerPoint = $null
$presentation = $null

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Add($false)

  # 16:9 widescreen in points. Every slide is a single native raster page.
  $presentation.PageSetup.SlideWidth = 960
  $presentation.PageSetup.SlideHeight = 540

  for ($index = 0; $index -lt $slideFiles.Count; $index += 1) {
    $slide = $presentation.Slides.Add($index + 1, 12)
    $slidePath = Join-Path $assetDir $slideFiles[$index]
    $null = $slide.Shapes.AddPicture(
      $slidePath,
      0,
      -1,
      0,
      0,
      $presentation.PageSetup.SlideWidth,
      $presentation.PageSetup.SlideHeight
    )
  }

  $presentation.SaveAs($resolvedOutput, 24)
  $presentation.Close()
  $presentation = $null
} finally {
  if ($null -ne $presentation) {
    $presentation.Close()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
  }
  if ($null -ne $powerPoint) {
    $powerPoint.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$output = Get-Item -LiteralPath $resolvedOutput
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput).Hash
[pscustomobject]@{
  path = $output.FullName
  bytes = $output.Length
  slides = $slideFiles.Count
  sha256 = $hash
} | ConvertTo-Json -Compress
