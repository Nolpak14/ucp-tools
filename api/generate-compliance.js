/**
 * Vercel Serverless Function: GDPR/Privacy Compliance Generator
 * POST /api/generate-compliance
 *
 * Generates privacy policy addendums and consent language for agentic commerce.
 *
 * Request body:
 *   {
 *     "companyName": "Your Company",
 *     "companyEmail": "privacy@example.com",
 *     "dpoEmail": "dpo@example.com",
 *     "regions": ["eu", "uk", "california"],
 *     "platforms": ["openai", "google"],
 *     "lawfulBasis": "contract",
 *     "includeMarketingConsent": true,
 *     "includeDataRetention": true,
 *     "retentionPeriodYears": 7
 *   }
 *
 * GET /api/generate-compliance
 *   Returns available options for regions, platforms, and lawful bases.
 */

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: Return available options
    if (req.method === 'GET') {
        try {
            const {
                getAvailableRegions,
                getLawfulBasisOptions,
                getAiPlatformOptions,
            } = await import('../src/compliance/index.js');

            return res.status(200).json({
                success: true,
                options: {
                    regions: getAvailableRegions(),
                    lawfulBases: getLawfulBasisOptions(),
                    platforms: getAiPlatformOptions(),
                },
            });
        } catch (error) {
            console.error('Error getting options:', error);
            return res.status(500).json({
                error: 'Failed to get options',
                message: error.message,
            });
        }
    }

    // POST: Generate compliance documents
    if (req.method === 'POST') {
        try {
            const {
                companyName,
                companyEmail,
                companyAddress,
                dpoEmail,
                regions,
                platforms,
                lawfulBasis,
                includeMarketingConsent,
                includeDataRetention,
                retentionPeriodYears,
                additionalProcessors,
            } = req.body || {};

            // Validate required fields
            if (!companyName || companyName.trim() === '') {
                return res.status(400).json({
                    error: 'Missing company name',
                    message: 'Please provide your company name',
                });
            }

            if (!regions || regions.length === 0) {
                return res.status(400).json({
                    error: 'Missing regions',
                    message: 'Please select at least one compliance region',
                });
            }

            if (!platforms || platforms.length === 0) {
                return res.status(400).json({
                    error: 'Missing platforms',
                    message: 'Please select at least one AI platform',
                });
            }

            if (!lawfulBasis) {
                return res.status(400).json({
                    error: 'Missing lawful basis',
                    message: 'Please select a lawful basis for processing',
                });
            }

            // Import the generator
            const { generateComplianceDocuments } = await import('../src/compliance/index.js');

            // Generate documents
            const result = generateComplianceDocuments({
                companyName: companyName.trim(),
                companyEmail: companyEmail || `privacy@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
                companyAddress,
                dpoEmail,
                regions,
                platforms,
                lawfulBasis,
                includeMarketingConsent: includeMarketingConsent || false,
                includeDataRetention: includeDataRetention || false,
                retentionPeriodYears: retentionPeriodYears || 7,
                additionalProcessors,
            });

            return res.status(200).json({
                success: true,
                ...result,
            });

        } catch (error) {
            console.error('Compliance generation error:', error);
            return res.status(500).json({
                error: 'Generation failed',
                message: error.message || 'An unexpected error occurred',
            });
        }
    }

    // Method not allowed
    return res.status(405).json({
        error: 'Method not allowed',
        message: 'Use GET for options or POST to generate documents',
    });
}
