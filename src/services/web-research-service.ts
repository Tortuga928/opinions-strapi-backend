/**
 * Web Research Service for SalesPilot AI
 * Performs automated web research on companies and contacts
 */

import googleSearchService from './google-search-service';
import aiService from './ai-service';

interface ResearchParams {
  companyName?: string;
  companyDomain?: string;
  contactName?: string;
  contactTitle?: string;
  contactLinkedIn?: string;
  industry?: string;
  researchDepth: 'Quick' | 'Standard' | 'Deep';
  additionalParties?: Array<{
    type: 'company' | 'contact';
    name: string;
    title?: string;
    linkedIn?: string;
  }>;
}

interface ResearchResult {
  companyInfo: {
    overview: string;
    recentNews: string[];
    financialInfo: string;
    competitors: string[];
    industryTrends: string[];
  };
  contactInfo: {
    background: string;
    expertise: string[];
    recentActivity: string[];
  };
  additionalContext: {
    executiveChanges: string[];
    productLaunches: string[];
    partnerships: string[];
  };
  sources: string[];
  queryCount: number;
}

/**
 * Research depth configurations
 */
const RESEARCH_CONFIGS = {
  Quick: {
    queries: 3,
    categories: ['company_overview', 'contact_background', 'industry_context']
  },
  Standard: {
    queries: 8,
    categories: [
      'company_overview',
      'contact_background',
      'industry_context',
      'recent_news',
      'financial_info',
      'competitors',
      'industry_trends',
      'contact_expertise'
    ]
  },
  Deep: {
    queries: 18,
    categories: [
      'company_overview',
      'contact_background',
      'industry_context',
      'recent_news',
      'financial_info',
      'competitors',
      'industry_trends',
      'contact_expertise',
      'executive_changes',
      'product_launches',
      'partnerships',
      'customer_sentiment',
      'regulatory_news',
      'market_position',
      'growth_strategy',
      'innovation_initiatives',
      'contact_publications',
      'contact_speaking_engagements'
    ]
  }
};

class WebResearchService {
  /**
   * Generate search queries based on research parameters and depth
   */
  private generateQueries(params: ResearchParams): string[] {
    const config = RESEARCH_CONFIGS[params.researchDepth];
    const queries: string[] = [];

    config.categories.forEach(category => {
      let query = '';

      switch (category) {
        case 'company_overview':
          query = params.companyDomain
            ? `site:${params.companyDomain} about company overview`
            : `"${params.companyName}" company overview`;
          break;

        case 'contact_background':
          if (params.contactName) {
            query = params.contactLinkedIn
              ? `site:linkedin.com "${params.contactName}" ${params.contactTitle || ''}`
              : `"${params.contactName}" ${params.contactTitle || ''} ${params.companyName || ''} professional background`;
          }
          break;

        case 'industry_context':
          query = params.industry
            ? `"${params.industry}" industry trends 2024 2025`
            : `"${params.companyName}" industry sector trends`;
          break;

        case 'recent_news':
          query = `"${params.companyName}" news latest 2024 2025`;
          break;

        case 'financial_info':
          query = `"${params.companyName}" financial performance revenue earnings`;
          break;

        case 'competitors':
          query = `"${params.companyName}" competitors competitive landscape`;
          break;

        case 'industry_trends':
          query = params.industry
            ? `"${params.industry}" market trends analysis`
            : `"${params.companyName}" market trends`;
          break;

        case 'contact_expertise':
          if (params.contactName) {
            query = `"${params.contactName}" expertise achievements thought leadership`;
          }
          break;

        case 'executive_changes':
          query = `"${params.companyName}" executive leadership changes appointments`;
          break;

        case 'product_launches':
          query = `"${params.companyName}" new product launch announcement`;
          break;

        case 'partnerships':
          query = `"${params.companyName}" partnership collaboration announcement`;
          break;

        case 'customer_sentiment':
          query = `"${params.companyName}" customer reviews feedback satisfaction`;
          break;

        case 'regulatory_news':
          query = `"${params.companyName}" regulatory compliance legal news`;
          break;

        case 'market_position':
          query = `"${params.companyName}" market share position ranking`;
          break;

        case 'growth_strategy':
          query = `"${params.companyName}" growth strategy expansion plans`;
          break;

        case 'innovation_initiatives':
          query = `"${params.companyName}" innovation R&D technology initiatives`;
          break;

        case 'contact_publications':
          if (params.contactName) {
            query = `"${params.contactName}" published articles papers research`;
          }
          break;

        case 'contact_speaking_engagements':
          if (params.contactName) {
            query = `"${params.contactName}" conference speaker presentation`;
          }
          break;
      }

      if (query) {
        queries.push(query);
      }
    });

    return queries.filter(q => q.length > 0);
  }

  /**
   * Perform web research based on parameters
   */
  async performResearch(params: ResearchParams): Promise<ResearchResult> {
    try {
      strapi.log.info(`Web Research: Starting ${params.researchDepth} research for ${params.companyName || 'unknown company'}`);

      // Generate search queries
      const queries = this.generateQueries(params);
      strapi.log.info(`Web Research: Generated ${queries.length} queries`);

      // Execute searches in parallel (with rate limiting)
      const searchResults = await this.executeSearches(queries);

      // Use AI to analyze and structure the results
      const structuredData = await this.analyzeResults(searchResults, params);

      strapi.log.info(`Web Research: Completed research with ${searchResults.length} total results`);

      return {
        ...structuredData,
        sources: this.extractSources(searchResults),
        queryCount: queries.length
      };

    } catch (error) {
      strapi.log.error('Web Research error:', error);
      throw new Error(`Research failed: ${error.message}`);
    }
  }

  /**
   * Execute searches with rate limiting to avoid quota issues
   */
  private async executeSearches(queries: string[]): Promise<any[]> {
    const allResults: any[] = [];
    const batchSize = 5; // Process 5 queries at a time
    const delayMs = 1000; // 1 second delay between batches

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      try {
        const batchResults = await Promise.all(
          batch.map(query => googleSearchService.search(query, 10))
        );
        allResults.push(...batchResults.flat());

        // Delay before next batch (except for last batch)
        if (i + batchSize < queries.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        strapi.log.warn(`Web Research: Batch ${i / batchSize + 1} failed:`, error.message);
        // Continue with next batch even if one fails
      }
    }

    // Deduplicate by URL
    return this.deduplicateResults(allResults);
  }

  /**
   * Deduplicate search results by URL
   */
  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    for (const result of results) {
      if (result.link && !seen.has(result.link)) {
        seen.add(result.link);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Use AI to analyze search results and extract structured data
   */
  private async analyzeResults(searchResults: any[], params: ResearchParams): Promise<Omit<ResearchResult, 'sources' | 'queryCount'>> {
    try {
      // Prepare context for AI
      const context = searchResults.map(r => ({
        title: r.title,
        snippet: r.snippet,
        url: r.link
      }));

      // Create analysis prompt
      const prompt = `Analyze the following web search results about ${params.companyName || 'the company'}${params.contactName ? ` and ${params.contactName}` : ''}.

Extract and structure the information into the following categories:

1. Company Overview: Brief summary of the company, what they do, size, headquarters
2. Recent News: Key recent events, announcements, or news (list up to 5 items)
3. Financial Information: Revenue, growth, funding, or any financial metrics mentioned
4. Competitors: Main competitors or competitive landscape
5. Industry Trends: Relevant industry trends or market conditions
${params.contactName ? `6. Contact Background: Information about ${params.contactName} - their role, background, expertise
7. Contact Recent Activity: Recent activities, publications, or achievements` : ''}
8. Additional Context: Any other relevant information (executive changes, product launches, partnerships)

Search Results:
${JSON.stringify(context, null, 2)}

Return a JSON object with this structure:
{
  "companyInfo": {
    "overview": "string",
    "recentNews": ["string"],
    "financialInfo": "string",
    "competitors": ["string"],
    "industryTrends": ["string"]
  },
  "contactInfo": {
    "background": "string",
    "expertise": ["string"],
    "recentActivity": ["string"]
  },
  "additionalContext": {
    "executiveChanges": ["string"],
    "productLaunches": ["string"],
    "partnerships": ["string"]
  }
}

Important: Extract only factual information from the search results. If information is not available, use empty strings or arrays.`;

      // Call AI service
      const aiResponse = await aiService.getCompletion(prompt, null, 4000);

      // Parse AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI analysis');

    } catch (error) {
      strapi.log.error('AI analysis error:', error);

      // Return minimal structure on error
      return {
        companyInfo: {
          overview: 'Analysis unavailable',
          recentNews: [],
          financialInfo: 'Not found',
          competitors: [],
          industryTrends: []
        },
        contactInfo: {
          background: 'Analysis unavailable',
          expertise: [],
          recentActivity: []
        },
        additionalContext: {
          executiveChanges: [],
          productLaunches: [],
          partnerships: []
        }
      };
    }
  }

  /**
   * Extract unique source URLs from results
   */
  private extractSources(results: any[]): string[] {
    return [...new Set(results.map(r => r.link).filter(Boolean))].slice(0, 20);
  }

  /**
   * Check if research is available (API configured)
   */
  isAvailable(): boolean {
    return googleSearchService.validateConfiguration();
  }
}

// Export singleton instance
export default new WebResearchService();
