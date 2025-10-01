export default {
  async sendPrompt(ctx) {
    try {
      strapi.log.info('AI Manager: Received prompt request');

      const { prompt } = ctx.request.body;

      // Validate prompt
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        strapi.log.error('AI Manager: Invalid prompt - empty or not a string');
        return ctx.badRequest('Prompt is required and must be a non-empty string');
      }

      if (prompt.length > 4000) {
        strapi.log.error('AI Manager: Prompt too long -', prompt.length, 'characters');
        return ctx.badRequest('Prompt exceeds maximum length of 4000 characters');
      }

      // Get user ID from authenticated request (optional for now)
      const userId = ctx.state.user?.id || null;
      strapi.log.info('AI Manager: Processing prompt for user:', userId || 'anonymous');

      // Call AI service to get streaming response
      const stream = await strapi
        .service('api::ai-manager.ai-manager')
        .generateResponse(prompt, userId);

      // Set headers for streaming response
      ctx.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Stream the response
      ctx.body = stream;

    } catch (error) {
      strapi.log.error('AI Manager prompt error:', error);

      // Return error in response field
      if (error.status === 429) {
        return ctx.tooManyRequests('Rate limit exceeded. Please try again later.');
      }

      return ctx.internalServerError('Failed to process prompt. Please try again.');
    }
  }
};
