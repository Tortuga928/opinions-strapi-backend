/**
 * quote-draft service
 */

import { factories } from '@strapi/strapi';
import googleSearchService from '../../../services/google-search-service';
import aiService from '../../../services/ai-service';

interface GenerateQuoteParams {
  category: string;
  generationType: string;
  generationSource: string;
  generationDetails?: string;
  userId: number;
}

export default factories.createCoreService('api::quote-draft.quote-draft', ({ strapi }) => ({
  /**
   * Generate quote from web search and AI extraction
   * Returns a complete QuoteDraft record
   */
  async generateQuoteFromWeb(params: GenerateQuoteParams) {
    const { category, generationType, generationSource, generationDetails, userId } = params;

    try {
      strapi.log.info(`Quote Draft Service: Starting generation for user ${userId}`);

      // Step 1: Perform Google searches (3 queries with AI-generated search terms)
      strapi.log.info('Quote Draft Service: Performing web searches...');
      const searchResults = await googleSearchService.searchQuotes({
        category,
        generationType,
        generationSource,
        generationDetails
      });

      if (!searchResults || searchResults.length === 0) {
        throw new Error('No search results found. Please try different criteria.');
      }

      strapi.log.info(`Quote Draft Service: Found ${searchResults.length} search results`);

      // Step 2: Use AI to extract best quote from search results
      strapi.log.info('Quote Draft Service: Extracting quote with AI...');
      const extractedQuote = await aiService.extractQuoteFromSearchResults(
        searchResults,
        {
          category,
          generationType,
          generationSource,
          generationDetails
        },
        userId
      );

      const selectedQuote = extractedQuote.selected_quote;
      strapi.log.info(`Quote Draft Service: Quote extracted with confidence ${selectedQuote.confidence_score}`);

      // Step 3: Find or create category
      const categoryRecord = await this.findOrCreateCategory(category);

      // Step 4: Create QuoteDraft record
      const quoteDraft = await strapi.entityService.create('api::quote-draft.quote-draft', {
        data: {
          quote_text: selectedQuote.quote_text,
          speaker_name: selectedQuote.speaker_name,
          publication_source: selectedQuote.publication_source,
          source_url: selectedQuote.source_url,
          confidence_score: selectedQuote.confidence_score,
          category: categoryRecord.id,
          generation_type: generationType as "Celebrity" | "Politician" | "Company Executive",
          generation_source: generationSource as "News" | "Research" | "Laws" | "Advertisements",
          generation_details: generationDetails || `Generated from ${generationSource} about ${generationType}`,
          user: userId,
          publishedAt: new Date()
        },
        populate: ['category']
      });

      strapi.log.info(`Quote Draft Service: Created draft ${quoteDraft.id}`);

      // Return both the quote draft and the candidate/reasoning data
      return {
        quoteDraft,
        candidates: extractedQuote.candidates,
        selection_reasoning: extractedQuote.selection_reasoning
      };

    } catch (error) {
      strapi.log.error('Quote Draft Service: Generation failed', error);
      throw error;
    }
  },

  /**
   * Find existing category or create new one
   */
  async findOrCreateCategory(categoryName: string) {
    // Try to find existing category
    const categories = await strapi.entityService.findMany('api::category.category', {
      filters: {
        name: categoryName
      },
      limit: 1
    });

    if (categories && categories.length > 0) {
      return categories[0];
    }

    // Create new category if not found
    const newCategory = await strapi.entityService.create('api::category.category', {
      data: {
        name: categoryName,
        publishedAt: new Date()
      }
    });

    strapi.log.info(`Quote Draft Service: Created new category "${categoryName}"`);
    return newCategory;
  }
}));
