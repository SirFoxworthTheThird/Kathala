param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][string[]]$Names)
Add-Type -AssemblyName System.Drawing
$source=[System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
try {
  New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
  $columns=3; $rows=2; $cellWidth=[Math]::Floor($source.Width/$columns); $cellHeight=[Math]::Floor($source.Height/$rows)
  for($i=0;$i -lt $Names.Count;$i++) {
    $x=($i%$columns)*$cellWidth; $y=[Math]::Floor($i/$columns)*$cellHeight
    $crop=[System.Drawing.Bitmap]::new([int]$cellWidth,[int]$cellHeight)
    try { $graphics=[System.Drawing.Graphics]::FromImage($crop); try { $graphics.DrawImage($source,(New-Object System.Drawing.Rectangle 0,0,$cellWidth,$cellHeight),(New-Object System.Drawing.Rectangle $x,$y,$cellWidth,$cellHeight),[System.Drawing.GraphicsUnit]::Pixel) } finally {$graphics.Dispose()}; $crop.Save((Join-Path $OutputDirectory ($Names[$i]+'.jpg')),[System.Drawing.Imaging.ImageFormat]::Jpeg) } finally {$crop.Dispose()}
  }
} finally {$source.Dispose()}
