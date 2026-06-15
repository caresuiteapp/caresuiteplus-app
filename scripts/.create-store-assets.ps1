
Add-Type -AssemblyName System.Drawing
function New-CsAsset($path, $w, $h, $drawText) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0,0)), ([System.Drawing.Point]::new($w,$h)), ([System.Drawing.Color]::FromArgb(255,248,250,252)), ([System.Drawing.Color]::FromArgb(255,255,255,255))
  $g.FillRectangle($bg, 0, 0, $w, $h)
  $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35,255,122,26))
  $g.FillEllipse($glow, [int]($w*0.55), [int]($h*0.15), [int]($w*0.35), [int]($h*0.25))
  $orbit = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80,53,215,255)), 2
  $g.DrawEllipse($orbit, [int]($w*0.2), [int]($h*0.25), [int]($w*0.6), [int]($h*0.5))
  if ($drawText) {
    $font = New-Object System.Drawing.Font 'Segoe UI', ([math]::Max(48, [int]($w/8))), [System.Drawing.FontStyle]::Bold
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,255,122,26))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, 0, $w, $h
    $g.DrawString('C+', $font, $brush, $rect, $sf)
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$assets = 'C:\\Users\\Kevin Reinhardt\\Documents\\CareSuite+\\assets'
New-CsAsset "$assets\icon.png" 1024 1024 $true
New-CsAsset "$assets\splash-icon.png" 1242 2436 $true
New-CsAsset "$assets\favicon.png" 512 512 $true
New-CsAsset "$assets\android-icon-foreground.png" 1024 1024 $true
New-CsAsset "$assets\android-icon-background.png" 1024 1024 $false
New-CsAsset "$assets\android-icon-monochrome.png" 1024 1024 $true
New-CsAsset "$assets\notification-icon.png" 96 96 $true
Write-Output 'OK'
