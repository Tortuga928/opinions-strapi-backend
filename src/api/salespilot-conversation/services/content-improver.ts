/**
 * content-improver.ts
 *
 * Service for AI-powered content improvement using Claude API
 * Allows iterative refinement of game plan sections
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ImprovementRequest {
  section: string;           // e.g., 'companyAnalysis', 'contactPersona'
  currentContent: string;    // Current section content
  improvementRequest: string; // User's improvement request
  gamePlanContext?: {        // Optional context for better improvements
    companyName?: string;
    contactName?: string;
    meetingSubject?: string;
  };
}

interface ImprovementResponse {
  success: boolean;
  original: string;
  improved: string;
  changes: string[];         // Summary of what changed
  rationale: string;         // Why these changes were made
}

/**
 * Generate improved content using Claude API
 */
export const improveContent = async (request: ImprovementRequest): Promise<ImprovementResponse> => {
  const { section, currentContent, improvementRequest, gamePlanContext } = request;

  // Build context string
  let contextStr = '';
  if (gamePlanContext) {
    if (gamePlanContext.companyName) contextStr += `Company: ${gamePlanContext.companyName}\n`;
    if (gamePlanContext.contactName) contextStr += `Contact: ${gamePlanContext.contactName}\n`;
    if (gamePlanContext.meetingSubject) contextStr += `Meeting Subject: ${gamePlanContext.meetingSubject}\n`;
  }

  // Map section to human-readable name
  const sectionNames = {
    companyAnalysis: 'Company Landscape Analysis',
    contactPersona: 'Contact Persona',
    influenceTactics: 'Influence Tactics',
    discussionPoints: 'Key Discussion Points',
    objectionHandling: 'Objection Handling'
  };

  const sectionName = sectionNames[section] || section;

  // Create improvement prompt
  const systemPrompt = `You are an expert sales strategist and content improvement assistant. Your job is to improve sales game plan content based on user feedback.

IMPORTANT RULES:
1. Make SPECIFIC, ACTIONABLE improvements based on the user's request
2. Preserve the overall structure and format
3. Keep the same level of detail unless asked to change it
4. Maintain a professional, strategic tone
5. Return ONLY the improved content - no explanations or meta-commentary in the content itself
6. After the improved content, provide a summary of changes and rationale

Format your response EXACTLY as follows:
---IMPROVED CONTENT---
[The improved content here]

---CHANGES SUMMARY---
[Bullet list of specific changes made]

---RATIONALE---
[Brief explanation of why these changes improve the content]`;

  const userPrompt = `${contextStr ? `Context:\n${contextStr}\n` : ''}Section: ${sectionName}

Current Content:
${currentContent}

User's Improvement Request:
${improvementRequest}

Please improve the content according to the user's request. Follow the format specified in your instructions.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const fullResponse = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the response
    const improvedMatch = fullResponse.match(/---IMPROVED CONTENT---\n([\s\S]*?)\n---CHANGES SUMMARY---/);
    const changesMatch = fullResponse.match(/---CHANGES SUMMARY---\n([\s\S]*?)\n---RATIONALE---/);
    const rationaleMatch = fullResponse.match(/---RATIONALE---\n([\s\S]*?)$/);

    const improved = improvedMatch ? improvedMatch[1].trim() : currentContent;
    const changesText = changesMatch ? changesMatch[1].trim() : 'Content updated based on request';
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : 'Content improved per user request';

    // Parse changes into array (split by bullet points or newlines)
    const changes = changesText
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0);

    return {
      success: true,
      original: currentContent,
      improved: improved,
      changes: changes,
      rationale: rationale
    };

  } catch (error) {
    console.error('Content improvement error:', error);
    throw new Error('Failed to improve content. Please try again.');
  }
};

/**
 * Validate section name
 */
export const isValidSection = (section: string): boolean => {
  const validSections = [
    'companyAnalysis',
    'contactPersona',
    'influenceTactics',
    'discussionPoints',
    'objectionHandling'
  ];
  return validSections.includes(section);
};
