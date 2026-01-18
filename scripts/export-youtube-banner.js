#!/usr/bin/env node
/**
 * Export YouTube banner HTML to PNG
 *
 * Usage:
 *   npm install puppeteer (if not installed)
 *   node scripts/export-youtube-banner.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function exportBanner() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set viewport to banner dimensions
    await page.setViewport({
        width: 2560,
        height: 1440,
        deviceScaleFactor: 1
    });

    // Load the HTML file
    const htmlPath = path.join(__dirname, '..', 'public', 'social', 'youtube-banner.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Take screenshot
    const outputPath = path.join(__dirname, '..', 'public', 'social', 'youtube-banner-2560x1440.png');
    await page.screenshot({
        path: outputPath,
        type: 'png',
        clip: {
            x: 0,
            y: 0,
            width: 2560,
            height: 1440
        }
    });

    console.log(`Banner exported to: ${outputPath}`);

    await browser.close();
}

exportBanner().catch(console.error);
