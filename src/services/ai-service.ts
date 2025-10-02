/**
 * Shared AI Service
 * Centralized service for all AI operations using Anthropic Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';

// Default configuration
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const MAX_TOKENS = 4096;

interface StreamingOptions {
  onChunk?: (text: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface QuoteCandidate {
  quote_text: string;
  speaker_name: string;
  publication_source: string;
  source_url: string;
  confidence_score: number;
}

interface QuoteExtractionResult {
  candidates: QuoteCandidate[];
  selected_quote: QuoteCandidate;
  selection_reasoning: string;
}

class AIService {
  private anthropic: Anthropic;
  private model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  }

  /**
   * Stream a completion response (for AI Manager and other streaming use cases)
   */
  async streamCompletion(prompt: string, userId?: number | null): Promise<Readable> {
    try {
      strapi.log.info(`AI Service: Streaming completion for user ${userId || 'anonymous'}`);

      // Save references to use inside the stream
      const anthropic = this.anthropic;
      const model = this.model;

      const stream = new Readable({
        async read() {
          try {
            const messageStream = await anthropic.messages.create({
              model,
              max_tokens: MAX_TOKENS,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ],
              stream: true
            });

            for await (const event of messageStream) {
              if (event.type === 'content_block_delta') {
                const delta = event.delta as any;
                if (delta?.text) {
                  this.push(`data: ${JSON.stringify({ text: delta.text })}\n\n`);
                }
              } else if (event.type === 'message_stop') {
                this.push('data: [DONE]\n\n');
                this.push(null);
              }
            }
          } catch (error) {
            strapi.log.error('AI streaming error:', error);
            this.push(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            this.push(null);
          }
        }
      });

      return stream;
    } catch (error) {
      strapi.log.error('AI Service initialization error:', error);
      throw error;
    }
  }

  /**
   * Get a non-streaming completion (for quote extraction and analysis)
   */
  async getCompletion(prompt: string, userId?: number | null, maxTokens: number = MAX_TOKENS): Promise<string> {
    try {
      strapi.log.info(`AI Service: Getting completion for user ${userId || 'anonymous'}`);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract text from response
      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      throw new Error('Unexpected response format from AI');
    } catch (error) {
      strapi.log.error('AI completion error:', error);
      throw error;
    }
  }

  /**
   * Extract quote data from search results
   * Returns structured quote information with confidence score
   */
  async extractQuoteFromSearchResults(
    searchResults: any[],
    criteria: {
      category: string;
      generationType: string;
      generationSource: string;
      generationDetails?: string;
    },
    userId?: number | null
  ): Promise<QuoteExtractionResult> {
    try {
      strapi.log.info(`AI Service: Extracting quote for user ${userId || 'anonymous'}`);

      // Build prompt for quote extraction
      const prompt = this.buildQuoteExtractionPrompt(searchResults, criteria);

      // Get AI response
      const responseText = await this.getCompletion(prompt, userId, 2000);

      // Parse JSON response
      const result = this.parseQuoteResponse(responseText);

      return result;
    } catch (error) {
      strapi.log.error('Quote extraction error:', error);
      throw new Error(`Failed to extract quote: ${error.message}`);
    }
  }

  /**
   * Build search query using AI
   */
  async buildSearchQuery(criteria: {
    category: string;
    generationType: string;
    generationSource: string;
    generationDetails?: string;
  }): Promise<string[]> {
    try {
      const prompt = `You are a search query expert. Build 3 different Google search queries to find real quotes from ${criteria.generationType} about ${criteria.category} from ${criteria.generationSource} sources.

${criteria.generationDetails ? `Additional context: ${criteria.generationDetails}` : ''}

Requirements:
- Each query should be different (different angles/approaches)
- Queries should be optimized for finding actual quotes with attribution
- Include terms like "quote", "said", "statement", "interview"
- Keep queries concise (5-10 words each)

Return ONLY a JSON array of 3 search queries, nothing else. Format:
["query 1", "query 2", "query 3"]`;

      const response = await this.getCompletion(prompt, null, 500);

      // Parse JSON response
      const queries = JSON.parse(response.trim());

      if (!Array.isArray(queries) || queries.length !== 3) {
        throw new Error('Invalid query format from AI');
      }

      return queries;
    } catch (error) {
      strapi.log.error('Search query generation error:', error);
      // Fallback to simple queries if AI fails
      return [
        `${criteria.generationType} quote ${criteria.category} ${criteria.generationSource}`,
        `${criteria.generationDetails || criteria.generationType} statement ${criteria.category}`,
        `${criteria.category} opinion ${criteria.generationSource} ${criteria.generationType}`
      ];
    }
  }

  /**
   * Build prompt for quote extraction
   */
  private buildQuoteExtractionPrompt(searchResults: any[], criteria: any): string {
    const resultsText = searchResults.map((result, index) =>
      `Result ${index + 1}:
Title: ${result.title}
URL: ${result.link}
Snippet: ${result.snippet}
`
    ).join('\n');

    return `You are an expert at extracting and validating quotes from search results. Analyze these Google search results and extract the TOP 3 best quotes that match the criteria, then select the best one.

CRITERIA:
- Type: ${criteria.generationType}
- Topic: ${criteria.category}
- Source Type: ${criteria.generationSource}
${criteria.generationDetails ? `- Additional Details: ${criteria.generationDetails}` : ''}

SEARCH RESULTS:
${resultsText}

TASK:
1. Find the TOP 3 quotes that match the criteria
2. For each quote, extract:
   - Exact quote text
   - Speaker's full name
   - Publication/source
   - URL from the search result
   - Confidence score (0-100) based on:
     * Source credibility (reputable news, research, official sites = higher)
     * Quote clarity and completeness
     * Attribution accuracy
     * Relevance to criteria
3. SELECT the best quote from your top 3
4. Provide reasoning for your selection (2-3 sentences explaining why this quote is the best)

IMPORTANT:
- Only select quotes that are clearly attributed to a real person
- Prefer quotes from credible sources
- The quote must match the requested type (${criteria.generationType})
- Quote should be related to ${criteria.category}

Return ONLY valid JSON in this exact format, nothing else:
{
  "candidates": [
    {
      "quote_text": "First candidate quote",
      "speaker_name": "Full Name",
      "publication_source": "Publication Name",
      "source_url": "https://...",
      "confidence_score": 85
    },
    {
      "quote_text": "Second candidate quote",
      "speaker_name": "Full Name",
      "publication_source": "Publication Name",
      "source_url": "https://...",
      "confidence_score": 80
    },
    {
      "quote_text": "Third candidate quote",
      "speaker_name": "Full Name",
      "publication_source": "Publication Name",
      "source_url": "https://...",
      "confidence_score": 75
    }
  ],
  "selected_quote": {
    "quote_text": "The selected quote (must be one of the candidates)",
    "speaker_name": "Full Name",
    "publication_source": "Publication Name",
    "source_url": "https://...",
    "confidence_score": 85
  },
  "selection_reasoning": "Explain why this quote was selected as the best option among the three candidates."
}`;
  }

  /**
   * Parse and validate quote response from AI
   */
  private parseQuoteResponse(responseText: string): QuoteExtractionResult {
    try {
      // Find JSON in response (in case AI adds explanation)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.candidates || !Array.isArray(parsed.candidates) || parsed.candidates.length !== 3) {
        throw new Error('Expected exactly 3 candidates in response');
      }

      if (!parsed.selected_quote || !parsed.selection_reasoning) {
        throw new Error('Missing selected_quote or selection_reasoning');
      }

      // Validate each candidate
      for (const candidate of parsed.candidates) {
        if (!candidate.quote_text || !candidate.speaker_name || !candidate.publication_source || !candidate.source_url) {
          throw new Error('Missing required fields in candidate');
        }
        // Validate and normalize confidence score
        const confidence = parseInt(candidate.confidence_score);
        candidate.confidence_score = (isNaN(confidence) || confidence < 0 || confidence > 100) ? 50 : confidence;
      }

      // Validate selected quote
      const selected = parsed.selected_quote;
      if (!selected.quote_text || !selected.speaker_name || !selected.publication_source || !selected.source_url) {
        throw new Error('Missing required fields in selected quote');
      }
      const confidence = parseInt(selected.confidence_score);
      selected.confidence_score = (isNaN(confidence) || confidence < 0 || confidence > 100) ? 50 : confidence;

      return {
        candidates: parsed.candidates,
        selected_quote: parsed.selected_quote,
        selection_reasoning: parsed.selection_reasoning.trim()
      };
    } catch (error) {
      strapi.log.error('Failed to parse quote response:', error);
      throw new Error(`Invalid quote data from AI: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new AIService();
