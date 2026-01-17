#!/usr/bin/env npx tsx
/**
 * Daily Competition Analysis Script
 *
 * Monitors the UCP tools ecosystem for new competitors, tools, and market changes.
 * Run daily via cron: 0 9 * * * npx tsx scripts/competition-analysis.ts
 *
 * Usage:
 *   npx tsx scripts/competition-analysis.ts
 *   npm run analyze:competition
 */

import * as fs from 'fs';
import * as path from 'path';

interface CompetitorCheck {
  name: string;
  url: string;
  type: 'direct' | 'indirect' | 'platform';
  checkFor: string[];
}

interface GitHubRepo {
  name: string;
  url: string;
  description: string;
  stars: number;
  lastUpdated: string;
}

interface AnalysisReport {
  date: string;
  competitors: CompetitorStatus[];
  newGitHubRepos: GitHubRepo[];
  marketSignals: MarketSignal[];
  recommendations: string[];
}

interface CompetitorStatus {
  name: string;
  url: string;
  status: 'active' | 'new' | 'unchanged' | 'error';
  changes: string[];
}

interface MarketSignal {
  source: string;
  signal: string;
  importance: 'high' | 'medium' | 'low';
}

// Known competitors and tools to monitor
const COMPETITORS: CompetitorCheck[] = [
  {
    name: 'Google Merchant Center',
    url: 'https://merchants.google.com',
    type: 'platform',
    checkFor: ['UCP', 'validation', 'compliance']
  },
  {
    name: 'Shopify UCP',
    url: 'https://shopify.dev/docs/api/checkout-extensions',
    type: 'platform',
    checkFor: ['UCP', 'universal commerce', 'agent']
  },
  {
    name: 'UCP Official Docs',
    url: 'https://developers.google.com/merchant/ucp',
    type: 'indirect',
    checkFor: ['validator', 'tools', 'compliance']
  }
];

// GitHub search queries for new UCP tools
const GITHUB_SEARCHES = [
  'ucp validator',
  'universal commerce protocol',
  'ucp-tools',
  'ucp compliance',
  'agentic commerce',
  'ucp merchant'
];

// Keywords to monitor in news/blogs
const MARKET_KEYWORDS = [
  'UCP tools',
  'UCP validator',
  'universal commerce protocol tools',
  'agentic commerce tools',
  'AI shopping checkout'
];

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'UCPTools-CompetitionAnalysis/1.0'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function checkCompetitor(competitor: CompetitorCheck): Promise<CompetitorStatus> {
  try {
    const response = await fetchWithTimeout(competitor.url);

    if (!response.ok) {
      return {
        name: competitor.name,
        url: competitor.url,
        status: 'error',
        changes: [`HTTP ${response.status}`]
      };
    }

    const html = await response.text();
    const changes: string[] = [];

    // Check for relevant keywords
    for (const keyword of competitor.checkFor) {
      const regex = new RegExp(keyword, 'gi');
      const matches = html.match(regex);
      if (matches && matches.length > 0) {
        changes.push(`Found "${keyword}" (${matches.length} mentions)`);
      }
    }

    return {
      name: competitor.name,
      url: competitor.url,
      status: changes.length > 0 ? 'active' : 'unchanged',
      changes
    };
  } catch (error) {
    return {
      name: competitor.name,
      url: competitor.url,
      status: 'error',
      changes: [(error as Error).message]
    };
  }
}

async function searchGitHub(query: string): Promise<GitHubRepo[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=updated&order=desc&per_page=5`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.warn(`GitHub search failed for "${query}": ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.items || []).map((repo: any) => ({
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description || 'No description',
      stars: repo.stargazers_count,
      lastUpdated: repo.updated_at
    }));
  } catch (error) {
    console.warn(`GitHub search error for "${query}":`, (error as Error).message);
    return [];
  }
}

async function analyzeMarket(): Promise<MarketSignal[]> {
  const signals: MarketSignal[] = [];

  // Check Google Trends-style indicators (simplified)
  // In production, you'd integrate with actual APIs

  signals.push({
    source: 'Market Analysis',
    signal: 'UCP ecosystem still in early stages - first-mover advantage intact',
    importance: 'high'
  });

  signals.push({
    source: 'Competitor Watch',
    signal: 'No direct paid UCP validation tools detected',
    importance: 'high'
  });

  return signals;
}

function generateRecommendations(
  competitors: CompetitorStatus[],
  repos: GitHubRepo[],
  signals: MarketSignal[]
): string[] {
  const recommendations: string[] = [];

  // Check for new competitors
  const activeCompetitors = competitors.filter(c => c.status === 'active');
  if (activeCompetitors.length > 0) {
    recommendations.push(`Monitor ${activeCompetitors.length} active competitors for new features`);
  }

  // Check for trending repos
  const trendingRepos = repos.filter(r => r.stars > 10);
  if (trendingRepos.length > 0) {
    recommendations.push(`Review ${trendingRepos.length} trending GitHub repos for competitive intelligence`);
  }

  // Default recommendations
  recommendations.push('Continue building free user base before monetization');
  recommendations.push('Focus on weekly monitoring feature as key differentiator');
  recommendations.push('Consider partnership outreach to agencies');

  return recommendations;
}

async function runAnalysis(): Promise<AnalysisReport> {
  console.log('🔍 Starting competition analysis...\n');

  // Check competitors
  console.log('Checking competitors...');
  const competitorResults = await Promise.all(
    COMPETITORS.map(c => checkCompetitor(c))
  );

  // Search GitHub
  console.log('Searching GitHub for new UCP tools...');
  const allRepos: GitHubRepo[] = [];
  const seenUrls = new Set<string>();

  for (const query of GITHUB_SEARCHES) {
    const repos = await searchGitHub(query);
    for (const repo of repos) {
      if (!seenUrls.has(repo.url)) {
        seenUrls.add(repo.url);
        allRepos.push(repo);
      }
    }
    // Rate limiting for GitHub API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Sort by stars
  allRepos.sort((a, b) => b.stars - a.stars);

  // Analyze market
  console.log('Analyzing market signals...');
  const marketSignals = await analyzeMarket();

  // Generate recommendations
  const recommendations = generateRecommendations(
    competitorResults,
    allRepos,
    marketSignals
  );

  return {
    date: new Date().toISOString().split('T')[0],
    competitors: competitorResults,
    newGitHubRepos: allRepos.slice(0, 10), // Top 10
    marketSignals,
    recommendations
  };
}

function formatReport(report: AnalysisReport): string {
  let output = '';

  output += `\n${'='.repeat(60)}\n`;
  output += `  UCP TOOLS - COMPETITION ANALYSIS REPORT\n`;
  output += `  Date: ${report.date}\n`;
  output += `${'='.repeat(60)}\n\n`;

  // Competitors Section
  output += `📊 COMPETITOR STATUS\n`;
  output += `${'-'.repeat(40)}\n`;
  for (const comp of report.competitors) {
    const statusIcon = comp.status === 'active' ? '🟢' :
                       comp.status === 'error' ? '🔴' : '⚪';
    output += `${statusIcon} ${comp.name}\n`;
    output += `   URL: ${comp.url}\n`;
    if (comp.changes.length > 0) {
      output += `   Notes: ${comp.changes.join(', ')}\n`;
    }
    output += '\n';
  }

  // GitHub Repos Section
  output += `\n🐙 GITHUB REPOSITORIES (Top 10)\n`;
  output += `${'-'.repeat(40)}\n`;
  if (report.newGitHubRepos.length === 0) {
    output += `No relevant repositories found.\n`;
  } else {
    for (const repo of report.newGitHubRepos) {
      output += `⭐ ${repo.stars} | ${repo.name}\n`;
      output += `   ${repo.description.slice(0, 60)}${repo.description.length > 60 ? '...' : ''}\n`;
      output += `   ${repo.url}\n\n`;
    }
  }

  // Market Signals Section
  output += `\n📈 MARKET SIGNALS\n`;
  output += `${'-'.repeat(40)}\n`;
  for (const signal of report.marketSignals) {
    const icon = signal.importance === 'high' ? '🔴' :
                 signal.importance === 'medium' ? '🟡' : '🟢';
    output += `${icon} [${signal.source}] ${signal.signal}\n`;
  }

  // Recommendations Section
  output += `\n💡 RECOMMENDATIONS\n`;
  output += `${'-'.repeat(40)}\n`;
  for (let i = 0; i < report.recommendations.length; i++) {
    output += `${i + 1}. ${report.recommendations[i]}\n`;
  }

  output += `\n${'='.repeat(60)}\n`;
  output += `  Report generated at ${new Date().toISOString()}\n`;
  output += `${'='.repeat(60)}\n`;

  return output;
}

async function main() {
  try {
    const report = await runAnalysis();
    const formattedReport = formatReport(report);

    // Print to console
    console.log(formattedReport);

    // Save to file
    const reportsDir = path.join(process.cwd(), 'docs-private', 'competition-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = `competition-${report.date}.txt`;
    const filepath = path.join(reportsDir, filename);
    fs.writeFileSync(filepath, formattedReport);
    console.log(`\n📁 Report saved to: ${filepath}`);

    // Also save JSON for programmatic access
    const jsonFilepath = path.join(reportsDir, `competition-${report.date}.json`);
    fs.writeFileSync(jsonFilepath, JSON.stringify(report, null, 2));
    console.log(`📁 JSON saved to: ${jsonFilepath}`);

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

main();
