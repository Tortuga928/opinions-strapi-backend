import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';

// Default model if not specified in environment
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const MAX_TOKENS = 4096;

export default () => ({
  async generateResponse(prompt: string, userId: number | null) {
    try {
      // Get model from environment or use default
      const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

      strapi.log.info(`AI Manager: Processing request for user ${userId || 'anonymous'} with model ${model}`);

      // Validate API key exists
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }

      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      // Create streaming response
      const stream = new Readable({
        async read() {
          try {
            // Call Anthropic API with streaming
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

            // Stream response chunks
            for await (const event of messageStream) {
              if (event.type === 'content_block_delta') {
                const delta = event.delta as any;
                if (delta?.text) {
                  this.push(`data: ${JSON.stringify({ text: delta.text })}\n\n`);
                }
              } else if (event.type === 'message_stop') {
                this.push('data: [DONE]\n\n');
                this.push(null); // End stream
              }
            }

          } catch (error) {
            strapi.log.error('Anthropic API streaming error:', {
              message: error.message,
              type: error.type,
              userId: userId || 'anonymous'
            });

            // Send error message to client
            const errorMessage = error.message || 'Failed to generate response';
            this.push(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
            this.push(null);
          }
        }
      });

      return stream;

    } catch (error) {
      strapi.log.error('AI Manager service initialization error:', {
        message: error.message,
        userId: userId || 'anonymous'
      });
      throw error;
    }
  }
});
