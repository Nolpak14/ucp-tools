/**
 * Vercel Serverless Function: Security Posture Scanner
 * POST /api/security-scan
 *
 * Scans UCP endpoints for common security misconfigurations.
 * Helps merchants understand their security posture before exposing
 * endpoints to AI agents.
 *
 * Request body:
 *   { "domain": "example.com", "options"?: { timeoutMs?: number } }
 *
 * Response:
 *   Security scan result including checks, score, grade, and recommendations.
 */

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Use POST to run a security scan',
        });
    }

    try {
        const { domain, options = {} } = req.body || {};

        if (!domain) {
            return res.status(400).json({
                error: 'Missing domain',
                message: 'Please provide a domain to scan',
            });
        }

        // Clean domain
        const cleanDomain = domain
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .toLowerCase()
            .trim();

        if (!cleanDomain) {
            return res.status(400).json({
                error: 'Invalid domain',
                message: 'Please provide a valid domain',
            });
        }

        // Dynamic import of the security scanner
        const { scanEndpointSecurity } = await import('../src/security/index.js');

        // Run security scan
        const scanOptions = {
            timeoutMs: options.timeoutMs || 15000,
        };

        const result = await scanEndpointSecurity(cleanDomain, scanOptions);

        // Build response
        const response = {
            ok: result.score >= 60,
            domain: result.domain,
            endpoint: result.endpoint,
            scanned_at: result.scanned_at,

            // Score and grade
            score: result.score,
            grade: result.grade,

            // Summary
            summary: result.summary,

            // All checks with details
            checks: result.checks.map(check => ({
                id: check.id,
                name: check.name,
                description: check.description,
                status: check.status,
                severity: check.severity,
                details: check.details,
                recommendation: check.recommendation,
            })),

            // Group by status for easier UI rendering
            by_status: {
                passed: result.checks.filter(c => c.status === 'pass'),
                failed: result.checks.filter(c => c.status === 'fail'),
                warnings: result.checks.filter(c => c.status === 'warn'),
                skipped: result.checks.filter(c => c.status === 'skip'),
            },

            // Critical issues that need immediate attention
            critical_issues: result.checks.filter(
                c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high')
            ),

            // Badge
            badge: {
                text: `Security: ${result.grade} (${result.score}/100)`,
                color: getBadgeColor(result.score),
            },
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Security scan error:', error);
        return res.status(500).json({
            error: 'Security scan failed',
            message: error.message || 'An unexpected error occurred',
        });
    }
}

/**
 * Get badge color from score
 */
function getBadgeColor(score) {
    if (score >= 90) return 'brightgreen';
    if (score >= 80) return 'green';
    if (score >= 70) return 'yellowgreen';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
}
