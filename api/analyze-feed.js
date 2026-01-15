/**
 * Vercel Serverless Function: Product Feed Quality Analyzer
 * POST /api/analyze-feed
 *
 * Analyzes product feed quality for AI agent visibility.
 *
 * Request body:
 *   {
 *     "url": "https://example.com/products",
 *     "maxProducts": 50,
 *     "includeProductDetails": true
 *   }
 *
 * GET /api/analyze-feed?url=https://example.com/products
 *   Quick analysis with default options.
 */

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Extract URL from query (GET) or body (POST)
    let url;
    let maxProducts = 50;
    let includeProductDetails = true;

    if (req.method === 'GET') {
        url = req.query.url;
        if (req.query.maxProducts) {
            maxProducts = parseInt(req.query.maxProducts, 10);
        }
        if (req.query.includeProductDetails === 'false') {
            includeProductDetails = false;
        }
    } else if (req.method === 'POST') {
        const body = req.body || {};
        url = body.url;
        maxProducts = body.maxProducts || 50;
        includeProductDetails = body.includeProductDetails !== false;
    } else {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Use GET or POST to analyze a product feed',
        });
    }

    // Validate URL
    if (!url) {
        return res.status(400).json({
            error: 'Missing URL',
            message: 'Please provide a URL to analyze',
        });
    }

    try {
        new URL(url);
    } catch {
        return res.status(400).json({
            error: 'Invalid URL',
            message: 'Please provide a valid URL',
        });
    }

    // Validate maxProducts
    if (maxProducts < 1 || maxProducts > 100) {
        return res.status(400).json({
            error: 'Invalid maxProducts',
            message: 'maxProducts must be between 1 and 100',
        });
    }

    try {
        // Fetch the page content
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'UCP-Tools Feed Analyzer/1.0 (https://ucp.day)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return res.status(400).json({
                error: 'Failed to fetch URL',
                message: `Server returned ${response.status}: ${response.statusText}`,
            });
        }

        const html = await response.text();

        // Import and run the analyzer
        const { analyzeProductFeedFromHtml } = await import('../src/feed-analyzer/index.js');

        const result = analyzeProductFeedFromHtml(html, url, {
            maxProducts,
            includeProductDetails,
        });

        // Check if any products were found
        if (result.productsFound === 0) {
            return res.status(200).json({
                success: true,
                warning: 'No products found',
                message: 'No Schema.org Product markup was found on this page. Make sure your page includes JSON-LD structured data with @type: "Product".',
                ...result,
            });
        }

        return res.status(200).json({
            success: true,
            ...result,
        });

    } catch (error) {
        console.error('Feed analysis error:', error);

        if (error.name === 'AbortError') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'The request took too long. The target server may be slow or unresponsive.',
            });
        }

        return res.status(500).json({
            error: 'Analysis failed',
            message: error.message || 'An unexpected error occurred',
        });
    }
}
