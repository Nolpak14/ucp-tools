/**
 * Generate Open Graph image (1200x630) for social sharing
 *
 * Run: npm install sharp && node scripts/generate-og-image.js
 */

const sharp = require('sharp');
const path = require('path');

const outputDir = path.join(__dirname, '../public');

async function generateOGImage() {
  // Create a simple OG image with brand gradient and logo
  const width = 1200;
  const height = 630;

  // Create SVG with brand gradient background and text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2E86AB;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#36B5A2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#47C97A;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="600" y="250" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">UCP.tools</text>
      <text x="600" y="350" font-family="Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.9)" text-anchor="middle">Universal Commerce Protocol</text>
      <text x="600" y="420" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.8)" text-anchor="middle">Profile Validator &amp; Generator</text>
      <text x="600" y="530" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.7)" text-anchor="middle">Get ready for AI-powered commerce</text>
    </svg>
  `;

  const output = path.join(outputDir, 'og-image.png');

  await sharp(Buffer.from(svg))
    .png()
    .toFile(output);

  console.log('Created: og-image.png (1200x630)');
  console.log('Output:', output);
}

generateOGImage().catch(console.error);
