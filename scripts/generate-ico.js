/**
 * Generate favicon.ico from PNG files
 *
 * Run: node scripts/generate-ico.js
 */

const { imagesToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');

async function generateIco() {
  const images = [
    fs.readFileSync(path.join(publicDir, 'favicon-16x16.png')),
    fs.readFileSync(path.join(publicDir, 'favicon-32x32.png'))
  ];
  const buf = await imagesToIco(images);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buf);
  console.log('Created: favicon.ico');
}

generateIco().catch(console.error);
