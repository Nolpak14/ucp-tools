/**
 * Generate favicons and app icons from logo
 *
 * Run: npm install sharp && node scripts/generate-favicons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputLogo = path.join(__dirname, '../public/logo.jpeg');
const outputDir = path.join(__dirname, '../public');

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'og-image-icon.png', size: 256 },
];

async function generateFavicons() {
  console.log('Generating favicons from:', inputLogo);

  for (const { name, size } of sizes) {
    const output = path.join(outputDir, name);
    await sharp(inputLogo)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(output);
    console.log(`Created: ${name} (${size}x${size})`);
  }

  // Generate ICO file (requires ico-endec or similar)
  // For now, we'll create a 32x32 PNG that browsers can use
  console.log('\nNote: For favicon.ico, use an online converter or:');
  console.log('  npm install png-to-ico');
  console.log('  Then convert favicon-32x32.png to favicon.ico');

  console.log('\nDone! Favicons generated in:', outputDir);
}

generateFavicons().catch(console.error);
