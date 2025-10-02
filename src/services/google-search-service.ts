/**
 * Google Search Service
 * Handles web searches using Google Custom Search API
 */

import { google } from 'googleapis';
import aiService from './ai-service';

// Configuration
const RESULTS_PER_SEARCH = 10;
const NUM_SEARCHES = 3;

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SearchCriteria {
  category: string;
  generationType: string;
  generationSource: string;
  generationDetails?: string;
}

class GoogleSearchService {
  private customSearch: any;
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    if (!process.env.GOOGLE_SEARCH_API_KEY) {
      throw new Error('GOOGLE_SEARCH_API_KEY is not configured');
    }

    if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
      throw new Error('GOOGLE_SEARCH_ENGINE_ID is not configured');
    }

    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    // Initialize Google Custom Search client
    this.customSearch = google.customsearch('v1');
  }

  /**
   * Perform Google search with given query
   */
  async search(query: string, num: number = RESULTS_PER_SEARCH): Promise<SearchResult[]> {
    try {
      strapi.log.info(`Google Search: Searching for "${query}"`);

      const response = await this.customSearch.cse.list({
        auth: this.apiKey,
        cx: this.searchEngineId,
        q: query,
        num: num
      });

      // Extract and format results
      const items = response.data.items || [];
      const results: SearchResult[] = items.map((item: any) => ({
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || ''
      }));

      strapi.log.info(`Google Search: Found ${results.length} results`);
      return results;

    } catch (error) {
      // Handle Google API errors
      if (error.code === 429) {
        throw new Error('Google Search API quota exceeded. Please try again later.');
      }

      if (error.code === 403) {
        throw new Error('Google Search API authentication failed. Check your API key.');
      }

      strapi.log.error('Google Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search for quotes using multiple AI-generated queries
   * Returns aggregated results from 3 different searches
   */
  async searchQuotes(criteria: SearchCriteria): Promise<SearchResult[]> {
    try {
      strapi.log.info(`Google Search: Searching quotes for ${criteria.generationType} about ${criteria.category}`);

      // Use AI to build 3 different search queries
      const queries = await aiService.buildSearchQuery(criteria);

      strapi.log.info(`Google Search: Generated queries: ${JSON.stringify(queries)}`);

      // Perform all 3 searches in parallel
      const searchPromises = queries.map(query => this.search(query));
      const searchResults = await Promise.all(searchPromises);

      // Flatten and deduplicate results by URL
      const allResults = searchResults.flat();
      const uniqueResults = this.deduplicateByUrl(allResults);

      strapi.log.info(`Google Search: Total unique results: ${uniqueResults.length}`);

      // Return top results (limit to 30 to avoid overwhelming AI)
      return uniqueResults.slice(0, 30);

    } catch (error) {
      strapi.log.error('Quote search error:', error);
      throw error;
    }
  }

  /**
   * Remove duplicate search results based on URL
   */
  private deduplicateByUrl(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.link)) {
        seen.add(result.link);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Validate Google API configuration
   */
  validateConfiguration(): boolean {
    return !!(this.apiKey && this.searchEngineId);
  }
}

// Export singleton instance
export default new GoogleSearchService();
