/**
 * Vercel Serverless Function: Generate AI Commerce Ready Badge
 * GET /api/badge?domain=example.com&style=flat
 *
 * Returns an SVG badge showing the AI readiness grade
 */

const GRADE_COLORS = {
  A: { bg: '#16A34A', text: '#DCFCE7' },
  B: { bg: '#2563EB', text: '#DBEAFE' },
  C: { bg: '#CA8A04', text: '#FEF9C3' },
  D: { bg: '#EA580C', text: '#FED7AA' },
  F: { bg: '#DC2626', text: '#FEE2E2' },
};

const READINESS_LABELS = {
  A: 'AI Commerce Ready',
  B: 'Mostly Ready',
  C: 'Partially Ready',
  D: 'Limited Readiness',
  F: 'Not Ready',
};

function generateFlatBadge(grade, domain, score) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.F;
  const label = READINESS_LABELS[grade] || 'Not Ready';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20" role="img" aria-label="AI Commerce: ${grade}">
  <title>AI Commerce: Grade ${grade} - ${label}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="180" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="95" height="20" fill="#555"/>
    <rect x="95" width="85" height="20" fill="${colors.bg}"/>
    <rect width="180" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="48.5" y="14">AI Commerce</text>
    <text x="137.5" y="14" font-weight="bold">${grade} ${score}/100</text>
  </g>
</svg>`;
}

function generateFlatSquareBadge(grade, domain, score) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.F;
  const label = READINESS_LABELS[grade] || 'Not Ready';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20" role="img" aria-label="AI Commerce: ${grade}">
  <title>AI Commerce: Grade ${grade} - ${label}</title>
  <g shape-rendering="crispEdges">
    <rect width="95" height="20" fill="#555"/>
    <rect x="95" width="85" height="20" fill="${colors.bg}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="48.5" y="14">AI Commerce</text>
    <text x="137.5" y="14" font-weight="bold">${grade} ${score}/100</text>
  </g>
</svg>`;
}

function generateLargeBadge(grade, domain, score) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.F;
  const label = READINESS_LABELS[grade] || 'Not Ready';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" role="img" aria-label="AI Commerce Ready: ${grade}">
  <title>AI Commerce: Grade ${grade} - ${label}</title>
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2E86AB;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#36B5A2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#47C97A;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="80" rx="8" fill="#1A2B3C"/>
  <rect x="2" y="2" width="196" height="76" rx="6" fill="none" stroke="url(#grad)" stroke-width="2"/>

  <!-- Grade circle -->
  <circle cx="40" cy="40" r="25" fill="${colors.bg}"/>
  <text x="40" y="47" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="24" font-weight="bold" fill="#fff">${grade}</text>

  <!-- Text -->
  <text x="75" y="30" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="#94A3B8">AI Commerce</text>
  <text x="75" y="48" font-family="Verdana,Geneva,sans-serif" font-size="14" font-weight="bold" fill="#fff">${label}</text>
  <text x="75" y="65" font-family="Verdana,Geneva,sans-serif" font-size="10" fill="#94A3B8">Score: ${score}/100 • ucptools.dev</text>
</svg>`;
}

function generateMiniBadge(grade) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.F;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" role="img" aria-label="Grade ${grade}">
  <title>AI Commerce Grade ${grade}</title>
  <rect width="40" height="20" rx="3" fill="${colors.bg}"/>
  <text x="20" y="14" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11" font-weight="bold" fill="#fff">${grade}</text>
</svg>`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, style = 'flat', grade: staticGrade, score: staticScore } = req.query;

  // If static grade provided (for previews), use that
  if (staticGrade) {
    const grade = staticGrade.toUpperCase();
    const score = parseInt(staticScore) || (grade === 'A' ? 95 : grade === 'B' ? 82 : grade === 'C' ? 71 : grade === 'D' ? 55 : 30);

    res.setHeader('Content-Type', 'image/svg+xml');

    switch (style) {
      case 'flat-square':
        return res.send(generateFlatSquareBadge(grade, '', score));
      case 'large':
        return res.send(generateLargeBadge(grade, '', score));
      case 'mini':
        return res.send(generateMiniBadge(grade));
      default:
        return res.send(generateFlatBadge(grade, '', score));
    }
  }

  if (!domain) {
    return res.status(400).json({ error: 'Missing required parameter: domain' });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

  try {
    // Fetch validation data from our own API
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://ucptools.dev';

    const validateRes = await fetch(`${baseUrl}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: cleanDomain }),
    });

    if (!validateRes.ok) {
      throw new Error('Validation failed');
    }

    const data = await validateRes.json();
    const grade = data.ai_readiness?.grade || 'F';
    const score = data.ai_readiness?.score || 0;

    res.setHeader('Content-Type', 'image/svg+xml');

    switch (style) {
      case 'flat-square':
        return res.send(generateFlatSquareBadge(grade, cleanDomain, score));
      case 'large':
        return res.send(generateLargeBadge(grade, cleanDomain, score));
      case 'mini':
        return res.send(generateMiniBadge(grade));
      default:
        return res.send(generateFlatBadge(grade, cleanDomain, score));
    }
  } catch (error) {
    // Return a gray "unknown" badge on error
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20" role="img">
  <rect width="180" height="20" rx="3" fill="#9CA3AF"/>
  <text x="90" y="14" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="#fff">AI Commerce • Unknown</text>
</svg>`);
  }
}
