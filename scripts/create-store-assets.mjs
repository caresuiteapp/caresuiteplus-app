#!/usr/bin/env node
/**
 * Erzeugt buildfähige CareSuite+ Store-Assets (Light Premium / Orange-Gold / Navy / Cyan).
 * Windows: System.Drawing; sonst: 1×1 Fallback via create-assets.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
mkdirSync(assetsDir, { recursive: true });

const psScript = `
Add-Type -AssemblyName System.Drawing
function New-CsAsset($path, $w, $h, $drawText, $monochrome) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $bgTop = [System.Drawing.Color]::FromArgb(255,248,250,252)
  $bgBottom = [System.Drawing.Color]::FromArgb(255,255,255,255)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0,0)), ([System.Drawing.Point]::new($w,$h)), $bgTop, $bgBottom
  $g.FillRectangle($bg, 0, 0, $w, $h)
  $orbit = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35,53,215,255))
  $g.FillEllipse($orbit, [int]($w*0.18), [int]($h*0.12), [int]($w*0.64), [int]($h*0.5))
  $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(50,255,122,26))
  $g.FillEllipse($glow, [int]($w*0.28), [int]($h*0.28), [int]($w*0.44), [int]($h*0.3))
  if ($drawText) {
    $font = New-Object System.Drawing.Font 'Segoe UI', ([math]::Max(48, [int]($w/8))), [System.Drawing.FontStyle]::Bold
    if ($monochrome) {
      $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,7,18,42))
    } else {
      $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,255,122,26))
    }
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, 0, $w, $h
    $g.DrawString('C+', $font, $brush, $rect, $sf)
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\icon.png' 1024 1024 $true $false
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\splash-icon.png' 1242 2436 $true $false
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\favicon.png' 512 512 $true $false
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\android-icon-foreground.png' 1024 1024 $true $false
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\android-icon-background.png' 1024 1024 $false $false
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\android-icon-monochrome.png' 1024 1024 $true $true
New-CsAsset '${assetsDir.replace(/\\/g, '\\\\')}\\notification-icon.png' 96 96 $true $true
Write-Output 'OK'
`;

try {
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, {
      stdio: 'inherit',
      cwd: root,
    });
    console.log('Created light-premium CareSuite+ assets in assets/');
  } else {
    execSync('node scripts/create-assets.mjs', { stdio: 'inherit', cwd: root });
    console.warn('Non-Windows: fallback 1×1 assets — run on Windows for full-size PNGs');
  }
} catch (e) {
  console.error('Asset generation failed:', e.message);
  process.exit(1);
}
