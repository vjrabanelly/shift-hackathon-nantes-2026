import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ── SVG sources (local copies in scripts/) ──
const FAVICON_SVG_PATH = path.resolve(__dirname, 'scrollout-favicon.svg');
const LOGO_SVG_PATH = path.resolve(__dirname, 'scrollout-logo.svg');

// Brand colors (from new SVGs)
const PURPLE = '#8C43E9';
const ORANGE = '#FF6701';
const WHITE = '#ffffff';
const DARK_BG = '#0a0a0a';

// Android icon sizes (ic_launcher PNGs)
const ICON_SIZES: Record<string, number> = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// Foreground icon sizes (ic_launcher_foreground, with safe zone padding)
const FOREGROUND_SIZES: Record<string, number> = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

// Splash screen sizes (portrait)
const SPLASH_PORTRAIT: Record<string, { w: number; h: number }> = {
  mdpi: { w: 480, h: 800 },
  hdpi: { w: 720, h: 1280 },
  xhdpi: { w: 960, h: 1600 },
  xxhdpi: { w: 1280, h: 1920 },
  xxxhdpi: { w: 1920, h: 2560 },
};

// Splash screen sizes (landscape)
const SPLASH_LANDSCAPE: Record<string, { w: number; h: number }> = {
  mdpi: { w: 800, h: 480 },
  hdpi: { w: 1280, h: 720 },
  xhdpi: { w: 1600, h: 960 },
  xxhdpi: { w: 1920, h: 1280 },
  xxxhdpi: { w: 2560, h: 1920 },
};

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Render the favicon SVG to a PNG at a given size (square).
 */
async function renderFaviconPng(size: number): Promise<Buffer> {
  const svgBuf = fs.readFileSync(FAVICON_SVG_PATH);
  return sharp(svgBuf)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Create ic_launcher foreground: favicon centered on white background with safe zone padding.
 * Android adaptive icons use 108dp canvas with 66dp visible area (18dp padding each side).
 */
async function createForegroundPng(size: number): Promise<Buffer> {
  const svgBuf = fs.readFileSync(FAVICON_SVG_PATH);
  // Icon should fill ~66/108 of the canvas = ~61%
  const iconSize = Math.round(size * 0.61);
  const iconPng = await sharp(svgBuf)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // Place centered on white canvas
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 255 },
    },
  })
    .composite([{
      input: iconPng,
      gravity: 'centre',
    }])
    .png()
    .toBuffer();
}

/**
 * Create ic_launcher: circular masked icon on transparent background.
 */
async function createIconPng(size: number): Promise<Buffer> {
  const svgBuf = fs.readFileSync(FAVICON_SVG_PATH);
  // The favicon SVG already has a white circle — render it directly
  return sharp(svgBuf)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * Create round icon: same as regular since the favicon is already circular.
 */
async function createRoundIconPng(size: number): Promise<Buffer> {
  const svgBuf = fs.readFileSync(FAVICON_SVG_PATH);
  const iconPng = await sharp(svgBuf)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create circular mask
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
  );

  return sharp(iconPng)
    .composite([{
      input: await sharp(mask).resize(size, size).png().toBuffer(),
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();
}

/**
 * Create splash screen: white background, favicon icon centered, "Scrollout" logo below.
 */
async function createSplashPng(width: number, height: number): Promise<Buffer> {
  const faviconSvg = fs.readFileSync(FAVICON_SVG_PATH);
  const logoSvg = fs.readFileSync(LOGO_SVG_PATH);

  const unit = Math.min(width, height);

  // Favicon icon: ~30% of the smallest dimension
  const iconSize = Math.round(unit * 0.3);
  const iconPng = await sharp(faviconSvg)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // Logo wordmark: width ~50% of screen width
  const logoWidth = Math.round(width * 0.45);
  const logoHeight = Math.round(logoWidth * (28 / 76)); // preserve aspect ratio
  const logoPng = await sharp(logoSvg)
    .resize(logoWidth, logoHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // Positions: icon slightly above center, logo below
  const totalHeight = iconSize + Math.round(unit * 0.04) + logoHeight;
  const startY = Math.round((height - totalHeight) / 2);

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 255 },
    },
  })
    .composite([
      {
        input: iconPng,
        left: Math.round((width - iconSize) / 2),
        top: startY,
      },
      {
        input: logoPng,
        left: Math.round((width - logoWidth) / 2),
        top: startY + iconSize + Math.round(unit * 0.04),
      },
    ])
    .png()
    .toBuffer();
}

async function generateAssets() {
  console.log('[generate-assets] Starting asset generation...');

  // Verify SVGs exist
  if (!fs.existsSync(FAVICON_SVG_PATH)) {
    throw new Error(`Favicon SVG not found: ${FAVICON_SVG_PATH}`);
  }
  if (!fs.existsSync(LOGO_SVG_PATH)) {
    throw new Error(`Logo SVG not found: ${LOGO_SVG_PATH}`);
  }

  const baseDir = path.resolve(path.join(__dirname, '../echa-app/android/app/src/main/res'));

  // 1. ic_launcher (standard + round)
  console.log('[generate-assets] Generating app icons...');
  for (const [density, size] of Object.entries(ICON_SIZES)) {
    const outputDir = path.join(baseDir, `mipmap-${density}`);
    ensureDir(outputDir);

    const iconPng = await createIconPng(size);
    fs.writeFileSync(path.join(outputDir, 'ic_launcher.png'), iconPng);

    const roundPng = await createRoundIconPng(size);
    fs.writeFileSync(path.join(outputDir, 'ic_launcher_round.png'), roundPng);

    console.log(`  ✓ mipmap-${density} (${size}px)`);
  }

  // 2. ic_launcher_foreground
  console.log('[generate-assets] Generating foregrounds...');
  for (const [density, size] of Object.entries(FOREGROUND_SIZES)) {
    const outputDir = path.join(baseDir, `mipmap-${density}`);
    ensureDir(outputDir);

    const fgPng = await createForegroundPng(size);
    fs.writeFileSync(path.join(outputDir, 'ic_launcher_foreground.png'), fgPng);

    console.log(`  ✓ foreground mipmap-${density} (${size}px)`);
  }

  // 3. Splash screens (portrait)
  console.log('[generate-assets] Generating splash screens (portrait)...');
  for (const [density, dims] of Object.entries(SPLASH_PORTRAIT)) {
    const outputDir = path.join(baseDir, `drawable-port-${density}`);
    ensureDir(outputDir);

    const png = await createSplashPng(dims.w, dims.h);
    fs.writeFileSync(path.join(outputDir, 'splash.png'), png);
    console.log(`  ✓ portrait ${density} (${dims.w}x${dims.h})`);
  }

  // 4. Splash screens (landscape)
  console.log('[generate-assets] Generating splash screens (landscape)...');
  for (const [density, dims] of Object.entries(SPLASH_LANDSCAPE)) {
    const outputDir = path.join(baseDir, `drawable-land-${density}`);
    ensureDir(outputDir);

    const png = await createSplashPng(dims.w, dims.h);
    fs.writeFileSync(path.join(outputDir, 'splash.png'), png);
    console.log(`  ✓ landscape ${density} (${dims.w}x${dims.h})`);
  }

  // 5. Base drawable splash
  const baseSplash = await createSplashPng(480, 800);
  fs.writeFileSync(path.join(baseDir, 'drawable/splash.png'), baseSplash);
  console.log('  ✓ drawable/splash.png (base)');

  // 6. Copy SVGs to project for reference
  const brandDir = path.resolve(path.join(__dirname, '../echa-app/www'));
  fs.copyFileSync(FAVICON_SVG_PATH, path.join(brandDir, 'favicon.svg'));
  console.log('  ✓ www/favicon.svg');

  // 7. Web logo for scrollout-site
  const sitePublicDir = path.resolve(path.join(__dirname, '../scrollout-site/public/brand'));
  if (fs.existsSync(sitePublicDir)) {
    const logoPng = await sharp(fs.readFileSync(LOGO_SVG_PATH))
      .resize(760, 280, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(sitePublicDir, 'scrollout-logo.png'), logoPng);
    fs.copyFileSync(LOGO_SVG_PATH, path.join(sitePublicDir, 'scrollout-logo.svg'));
    fs.copyFileSync(FAVICON_SVG_PATH, path.join(sitePublicDir, 'scrollout-favicon.svg'));
    console.log('  ✓ scrollout-site brand assets');
  }

  console.log('[generate-assets] All assets generated successfully!');
}

generateAssets().catch((err) => {
  console.error('[generate-assets] Error:', err);
  process.exit(1);
});
