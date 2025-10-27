/**
 * web-research.ts
 *
 * Web Research Service for SalesPilot AI
 * Performs automated web research using Google Custom Search API
 *
 * Research Depths:
 * - Quick (2-3 queries): Company overview, contact background, basic industry context
 * - Standard (5-10 queries): + Recent news, financial info, competitor landscape, industry trends
 * - Deep (15-20 queries): + Executive changes, product launches, customer sentiment, partnerships, regulatory news
 */

import axios from 'axios';

// Google Custom Search API configuration
const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const GOOGLE_SEARCH_API_URL = 'https://www.googleapis.com/customsearch/v1';

/**
 * Research depth configurations
 */
export const RESEARCH_DEPTHS = {
  quick: {
    name: 'Quick',
    queryCount: 3,
    description: 'Basic company overview, contact background, and industry context'
  },
  standard: {
    name: 'Standard',
    queryCount: 10,
    description: 'Comprehensive research including news, financial info, and industry trends'
  },
  deep: {
    name: 'Deep',
    queryCount: 20,
    description: 'In-depth analysis including executive changes, partnerships, and market sentiment'
  }
};

/**
 * Research result interface
 */
interface ResearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  relevanceScore: number;
}

interface CompanyResearch {
  companyName: string;
  domain?: string;
  overview: ResearchResult[];
  news: ResearchResult[];
  financial: ResearchResult[];
  industry: ResearchResult[];
  products: ResearchResult[];
  leadership: ResearchResult[];
  allResults: ResearchResult[];
}

interface ContactResearch {
  contactName: string;
  linkedInUrl?: string;
  background: ResearchResult[];
  recentActivity: ResearchResult[];
  professionalInfo: ResearchResult[];
  allResults: ResearchResult[];
}

interface ResearchData {
  companies: CompanyResearch[];
  contacts: ContactResearch[];
  industry: ResearchResult[];
  competitors: ResearchResult[];
  totalQueries: number;
  depth: string;
  timestamp: string;
}

/**
 * Generate search queries based on research parameters and depth
 */
function generateSearchQueries(params: {
  companyName?: string;
  companyDomain?: string;
  contactName?: string;
  contactLinkedIn?: string;
  industry?: string;
  additionalCompanies?: string[];
  additionalContacts?: string[];
  depth: 'quick' | 'standard' | 'deep';
}): string[] {
  const queries: string[] = [];
  const { companyName, companyDomain, contactName, industry, depth } = params;

  // QUICK RESEARCH (2-3 queries)
  if (companyName) {
    queries.push(`${companyName} company overview products services`);
  }
  if (contactName && companyName) {
    queries.push(`${contactName} ${companyName} background experience`);
  }
  if (industry && companyName) {
    queries.push(`${companyName} ${industry} industry position`);
  }

  // STANDARD RESEARCH (additional 5-7 queries)
  if (depth === 'standard' || depth === 'deep') {
    if (companyName) {
      queries.push(`${companyName} recent news 2024 2025`);
      queries.push(`${companyName} financial performance revenue`);
      queries.push(`${companyName} leadership executives team`);
    }
    if (industry) {
      queries.push(`${industry} industry trends 2024 2025`);
      queries.push(`${industry} market analysis competitors`);
    }
    if (companyDomain) {
      queries.push(`site:${companyDomain} products services solutions`);
      queries.push(`site:${companyDomain} news announcements press`);
    }
    if (contactName) {
      queries.push(`${contactName} professional profile LinkedIn achievements`);
    }
  }

  // DEEP RESEARCH (additional 10+ queries)
  if (depth === 'deep') {
    if (companyName) {
      queries.push(`${companyName} customer reviews testimonials case studies`);
      queries.push(`${companyName} partnerships strategic alliances`);
      queries.push(`${companyName} product launches innovations 2024`);
      queries.push(`${companyName} executive changes appointments`);
      queries.push(`${companyName} funding investment Series`);
      queries.push(`${companyName} awards recognition industry`);
    }
    if (industry && companyName) {
      queries.push(`${companyName} ${industry} competitive analysis`);
      queries.push(`${companyName} ${industry} regulatory compliance`);
    }
    if (contactName && companyName) {
      queries.push(`${contactName} ${companyName} speaking presentations`);
      queries.push(`${contactName} thought leadership articles`);
    }
    if (companyDomain) {
      queries.push(`site:${companyDomain} mission vision values`);
      queries.push(`site:${companyDomain} careers culture`);
    }
  }

  return queries;
}

/**
 * Execute Google Custom Search API query
 */
async function executeGoogleSearch(query: string): Promise<any> {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    throw new Error('Google Custom Search API credentials not configured');
  }

  try {
    const response = await axios.get(GOOGLE_SEARCH_API_URL, {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 5, // Get top 5 results per query
      },
      timeout: 10000, // 10 second timeout
    });

    return response.data;
  } catch (error) {
    console.error(`[WebResearch] Google Search API error for query "${query}":`, error.message);

    // Return empty results on error
    return { items: [] };
  }
}

/**
 * Parse and filter Google Search results
 */
function parseSearchResults(searchResponse: any, query: string): ResearchResult[] {
  const items = searchResponse.items || [];

  return items.map((item: any, index: number) => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
    source: extractDomain(item.link || ''),
    // Relevance score: higher for top results
    relevanceScore: 1.0 - (index * 0.1)
  }));
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Categorize research results
 */
function categorizeResults(allResults: ResearchResult[], params: any): {
  overview: ResearchResult[];
  news: ResearchResult[];
  financial: ResearchResult[];
  industry: ResearchResult[];
  products: ResearchResult[];
  leadership: ResearchResult[];
} {
  const categories = {
    overview: [] as ResearchResult[],
    news: [] as ResearchResult[],
    financial: [] as ResearchResult[],
    industry: [] as ResearchResult[],
    products: [] as ResearchResult[],
    leadership: [] as ResearchResult[]
  };

  allResults.forEach(result => {
    const lowerTitle = result.title.toLowerCase();
    const lowerSnippet = result.snippet.toLowerCase();
    const combined = lowerTitle + ' ' + lowerSnippet;

    // Categorize based on keywords
    if (combined.includes('news') || combined.includes('announcement') || combined.includes('press release')) {
      categories.news.push(result);
    }
    if (combined.includes('revenue') || combined.includes('financial') || combined.includes('earnings') || combined.includes('profit')) {
      categories.financial.push(result);
    }
    if (combined.includes('product') || combined.includes('service') || combined.includes('solution') || combined.includes('offering')) {
      categories.products.push(result);
    }
    if (combined.includes('ceo') || combined.includes('executive') || combined.includes('leadership') || combined.includes('founder')) {
      categories.leadership.push(result);
    }
    if (combined.includes('industry') || combined.includes('market') || combined.includes('sector') || combined.includes('trend')) {
      categories.industry.push(result);
    }
    if (combined.includes('overview') || combined.includes('about') || combined.includes('company profile')) {
      categories.overview.push(result);
    }
  });

  return categories;
}

/**
 * Deduplicate results by URL
 */
function deduplicateResults(results: ResearchResult[]): ResearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    if (seen.has(result.link)) {
      return false;
    }
    seen.add(result.link);
    return true;
  });
}

/**
 * Main research function
 */
export async function performWebResearch(params: {
  companyName?: string;
  companyDomain?: string;
  contactName?: string;
  contactLinkedIn?: string;
  industry?: string;
  additionalCompanies?: string[];
  additionalContacts?: string[];
  depth: 'quick' | 'standard' | 'deep';
  onProgress?: (current: number, total: number, query: string) => void;
}): Promise<ResearchData> {
  console.log('[WebResearch] Starting research with params:', {
    companyName: params.companyName,
    depth: params.depth,
    hasOnProgress: !!params.onProgress
  });

  // Generate search queries
  const queries = generateSearchQueries(params);
  const totalQueries = queries.length;

  console.log(`[WebResearch] Generated ${totalQueries} queries for ${params.depth} research`);

  // Execute all queries
  const allResults: ResearchResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    // Report progress
    if (params.onProgress) {
      params.onProgress(i + 1, totalQueries, query);
    }

    console.log(`[WebResearch] Executing query ${i + 1}/${totalQueries}: ${query}`);

    try {
      const searchResponse = await executeGoogleSearch(query);
      const results = parseSearchResults(searchResponse, query);
      allResults.push(...results);

      console.log(`[WebResearch] Query ${i + 1} returned ${results.length} results`);

      // Small delay to respect API rate limits
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`[WebResearch] Error executing query ${i + 1}:`, error.message);
      // Continue with next query
    }
  }

  // Deduplicate results
  const uniqueResults = deduplicateResults(allResults);
  console.log(`[WebResearch] Total unique results: ${uniqueResults.length}`);

  // Categorize results for company
  const companyCategories = categorizeResults(uniqueResults, params);

  // Build research data structure
  const researchData: ResearchData = {
    companies: params.companyName ? [{
      companyName: params.companyName,
      domain: params.companyDomain,
      overview: companyCategories.overview,
      news: companyCategories.news,
      financial: companyCategories.financial,
      industry: companyCategories.industry,
      products: companyCategories.products,
      leadership: companyCategories.leadership,
      allResults: uniqueResults
    }] : [],
    contacts: params.contactName ? [{
      contactName: params.contactName,
      linkedInUrl: params.contactLinkedIn,
      background: uniqueResults.filter(r =>
        r.title.toLowerCase().includes(params.contactName?.toLowerCase() || '') ||
        r.snippet.toLowerCase().includes(params.contactName?.toLowerCase() || '')
      ),
      recentActivity: [],
      professionalInfo: [],
      allResults: []
    }] : [],
    industry: companyCategories.industry,
    competitors: [],
    totalQueries: totalQueries,
    depth: params.depth,
    timestamp: new Date().toISOString()
  };

  console.log('[WebResearch] Research complete:', {
    companies: researchData.companies.length,
    contacts: researchData.contacts.length,
    totalResults: uniqueResults.length
  });

  return researchData;
}

/**
 * Validate research configuration
 */
export function validateResearchConfig(): { valid: boolean; error?: string } {
  if (!GOOGLE_API_KEY) {
    return {
      valid: false,
      error: 'Google Search API key not configured (GOOGLE_SEARCH_API_KEY environment variable)'
    };
  }

  if (!GOOGLE_SEARCH_ENGINE_ID) {
    return {
      valid: false,
      error: 'Google Search Engine ID not configured (GOOGLE_SEARCH_ENGINE_ID environment variable)'
    };
  }

  return { valid: true };
}
