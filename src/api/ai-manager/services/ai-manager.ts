/**
 * AI Manager Service
 * Now uses shared AI service for consistency
 */

import aiService from '../../../services/ai-service';

export default () => ({
  async generateResponse(prompt: string, userId: number | null) {
    try {
      strapi.log.info(`AI Manager: Processing request for user ${userId || 'anonymous'}`);

      // Use shared AI service for streaming
      const stream = await aiService.streamCompletion(prompt, userId);

      return stream;

    } catch (error) {
      strapi.log.error('AI Manager service error:', {
        message: error.message,
        userId: userId || 'anonymous'
      });
      throw error;
    }
  }
});
