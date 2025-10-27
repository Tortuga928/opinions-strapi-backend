/**
 * game-plan-generator.ts
 *
 * AI-Powered Game Plan Analysis Generator
 * Uses Claude API to transform research data into actionable sales intelligence
 */

import Anthropic from '@anthropic-ai/sdk';
import progressTracker from './progress-tracker';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Generate Company Landscape Analysis
 */
export async function generateCompanyAnalysis(params: {
  companyName: string;
  industry: string;
  researchData: any;
}): Promise<string> {
  const { companyName, industry, researchData } = params;

  try {
    const companyData = researchData?.companies?.[0] || {};
    const allResults = companyData.allResults || [];

    const researchContext = allResults
      .slice(0, 15)
      .map((result: any) => `- ${result.title}: ${result.snippet}`)
      .join('\n');

    const prompt = `You are a sales intelligence analyst. Analyze this company and provide a comprehensive landscape analysis.

COMPANY: ${companyName}
INDUSTRY: ${industry}

RESEARCH FINDINGS:
${researchContext || 'Limited research data available'}

Generate a structured company landscape analysis with these sections:

1. RECENT EVENTS (3-5 key developments in last 6-12 months)
2. CURRENT CHALLENGES (3-4 major business pressures)
3. OPPORTUNITIES (3-4 growth areas)
4. COMPETITIVE LANDSCAPE (main competitors and positioning)
5. KEY METRICS & PERFORMANCE (financial indicators, market share)

Keep each section concise. Use bullet points. Be specific and actionable.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('[GamePlanGenerator] Company analysis error:', error);
    throw new Error('Failed to generate company analysis');
  }
}

/**
 * Generate Contact Persona Profile
 */
export async function generateContactPersona(params: {
  contactName: string;
  contactTitle: string;
  companyName: string;
  industry: string;
  researchData: any;
  detailLevel: 'Brief' | 'Standard' | 'Detailed';
}): Promise<string> {
  const { contactName, contactTitle, companyName, industry, researchData, detailLevel } = params;

  try {
    const contactData = researchData?.contacts?.[0] || {};
    const backgroundInfo = contactData.background || [];

    const researchContext = backgroundInfo
      .slice(0, 10)
      .map((result: any) => `- ${result.title}: ${result.snippet}`)
      .join('\n');

    const detailInstructions = {
      Brief: 'Create a concise 3-5 bullet point profile.',
      Standard: 'Create a comprehensive 1-page profile.',
      Detailed: 'Create an extensive 2-page profile with deep behavioral insights.'
    };

    const prompt = `You are a sales intelligence analyst. Create a persona profile for this contact.

CONTACT: ${contactName}
TITLE: ${contactTitle}
COMPANY: ${companyName}
INDUSTRY: ${industry}

RESEARCH FINDINGS:
${researchContext || 'Use industry knowledge and title context'}

DETAIL LEVEL: ${detailLevel}
INSTRUCTIONS: ${detailInstructions[detailLevel]}

Generate a structured persona with:
1. COMMUNICATION STYLE
2. PRIMARY MOTIVATORS
3. DECISION-MAKING APPROACH
4. CAREER BACKGROUND & EXPERTISE
${detailLevel === 'Detailed' ? '\n5. BEHAVIORAL INSIGHTS\n6. ENGAGEMENT STRATEGIES' : ''}

Format with headers and bullet points. Be specific and actionable.`;

    const maxTokens = { Brief: 500, Standard: 1200, Detailed: 2500 };

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens[detailLevel],
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('[GamePlanGenerator] Persona generation error:', error);
    throw new Error('Failed to generate contact persona');
  }
}

/**
 * Generate Influence Tactics
 */
export async function generateInfluenceTactics(params: {
  contactName: string;
  contactTitle: string;
  companyName: string;
  meetingSubject: string;
  desiredOutcome: string;
  framework: string;
  companyAnalysis: string;
  contactPersona: string;
}): Promise<string> {
  const { contactName, contactTitle, companyName, meetingSubject, desiredOutcome, framework, companyAnalysis, contactPersona } = params;

  try {
    const frameworkInstructions = {
      Hybrid: 'Combine proven influence tactics with custom recommendations.',
      Cialdini: 'Apply Cialdini\'s 7 principles: Reciprocity, Authority, Social Proof, Liking, Scarcity, Consistency, Unity.',
      SPIN: 'Structure around SPIN: Situation, Problem, Implication, Need-Payoff questions.',
      Challenger: 'Apply Challenger Sale: Teach, Tailor, Take Control.',
      Sandler: 'Use Sandler: Focus on Pain, Budget, Decision process.'
    };

    const prompt = `You are a sales strategy consultant. Generate influence tactics for this meeting.

CONTEXT:
Contact: ${contactName} (${contactTitle})
Company: ${companyName}
Meeting Subject: ${meetingSubject}
Desired Outcome: ${desiredOutcome}

COMPANY ANALYSIS:
${companyAnalysis}

CONTACT PERSONA:
${contactPersona}

FRAMEWORK: ${framework}
APPROACH: ${frameworkInstructions[framework] || frameworkInstructions.Hybrid}

Generate 3-5 specific, actionable influence tactics.

Format each as:
## TACTIC [Number]: [Name]
[Explanation and why it works]
[Specific example for this meeting]

Be concrete and actionable.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('[GamePlanGenerator] Influence tactics error:', error);
    throw new Error('Failed to generate influence tactics');
  }
}

/**
 * Generate Key Discussion Points
 */
export async function generateDiscussionPoints(params: {
  companyName: string;
  meetingSubject: string;
  desiredOutcome: string;
  companyAnalysis: string;
  contactPersona: string;
}): Promise<string> {
  const { companyName, meetingSubject, desiredOutcome, companyAnalysis, contactPersona } = params;

  try {
    const prompt = `You are a sales strategist creating a discussion guide.

CONTEXT:
Company: ${companyName}
Meeting Subject: ${meetingSubject}
Desired Outcome: ${desiredOutcome}

COMPANY ANALYSIS:
${companyAnalysis}

CONTACT PERSONA:
${contactPersona}

Generate a structured discussion guide with:
1. OPENING TOPICS (2-3 rapport-building topics)
2. CORE DISCUSSION POINTS (3-5 main topics with questions)
3. VALUE PROPOSITION ANGLES (2-3 ways to frame value)
4. DESIRED OUTCOME PATH (steps to guide conversation)

Format with headers and bullet points. Include specific questions.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('[GamePlanGenerator] Discussion points error:', error);
    throw new Error('Failed to generate discussion points');
  }
}

/**
 * Generate Objection Handling Strategies
 */
export async function generateObjectionHandling(params: {
  companyName: string;
  meetingSubject: string;
  detailLevel: 'Brief' | 'Standard' | 'Detailed';
  companyAnalysis: string;
  contactPersona: string;
}): Promise<string> {
  const { companyName, meetingSubject, detailLevel, companyAnalysis, contactPersona } = params;

  try {
    const objectionCounts = { Brief: 3, Standard: 7, Detailed: 12 };
    const count = objectionCounts[detailLevel];

    const prompt = `You are a sales objection handling expert.

CONTEXT:
Company: ${companyName}
Meeting Subject: ${meetingSubject}

COMPANY ANALYSIS:
${companyAnalysis}

CONTACT PERSONA:
${contactPersona}

Generate ${count} most likely objections with responses.

${detailLevel === 'Detailed' ? 'Organize by: Price/Budget, Timing, Competitive, Internal Political, Risk/Change' : ''}

For each objection:
## OBJECTION [Number]: [Statement]
**Why they might raise this**: [Context]
**Response Strategy**: [How to address]
**Example Response**: [Actual words]
${detailLevel === 'Detailed' ? '**Follow-up Questions**: [Questions after responding]' : ''}

Make objections realistic and responses persuasive.`;

    const maxTokens = { Brief: 800, Standard: 1800, Detailed: 3000 };

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens[detailLevel],
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('[GamePlanGenerator] Objection handling error:', error);
    throw new Error('Failed to generate objection handling');
  }
}

/**
 * Generate Complete Game Plan Analysis
 */
export async function generateCompleteAnalysis(params: {
  companyName: string;
  contactName: string;
  contactTitle: string;
  industry: string;
  meetingSubject: string;
  desiredOutcome: string;
  personaDetailLevel: string;
  influenceFramework: string;
  researchData: any;
  analysisId?: string; // Optional - for progress tracking
  onProgress?: (stage: string, percentage: number) => void;
}): Promise<any> {
  const {
    companyName,
    contactName,
    contactTitle,
    industry,
    meetingSubject,
    desiredOutcome,
    personaDetailLevel,
    influenceFramework,
    researchData,
    analysisId,
    onProgress
  } = params;

  // Helper function to report progress to both callback and tracker
  const reportProgress = (phaseNumber: number, stage: string, percentage: number) => {
    // Report to callback (backward compatibility)
    if (onProgress) onProgress(stage, percentage);

    // Report to progress tracker with phase timing (if analysisId provided)
    if (analysisId) {
      progressTracker.updatePhaseProgress(analysisId, phaseNumber, stage, percentage);
    }
  };

  try {
    console.log('[GamePlanGenerator] Starting complete analysis generation');

    // Initialize phase timings if analysisId provided
    if (analysisId) {
      progressTracker.initializePhaseTimings(analysisId);
    }

    // Stage 1: Company Analysis (Phase 1, 20%)
    reportProgress(1, 'Analyzing company landscape...', 20);
    const companyAnalysis = await generateCompanyAnalysis({
      companyName,
      industry,
      researchData
    });

    // Stage 2: Contact Persona (Phase 2, 40%)
    reportProgress(2, `Generating ${personaDetailLevel} persona...`, 40);
    const contactPersona = await generateContactPersona({
      contactName,
      contactTitle,
      companyName,
      industry,
      researchData,
      detailLevel: personaDetailLevel as 'Brief' | 'Standard' | 'Detailed'
    });

    // Stage 3: Influence Tactics (Phase 3, 60%)
    reportProgress(3, 'Generating influence tactics...', 60);
    const influenceTactics = await generateInfluenceTactics({
      contactName,
      contactTitle,
      companyName,
      meetingSubject,
      desiredOutcome,
      framework: influenceFramework,
      companyAnalysis,
      contactPersona
    });

    // Stage 4: Discussion Points (Phase 4, 80%)
    reportProgress(4, 'Generating discussion points...', 80);
    const discussionPoints = await generateDiscussionPoints({
      companyName,
      meetingSubject,
      desiredOutcome,
      companyAnalysis,
      contactPersona
    });

    // Stage 5: Objection Handling (Phase 5, 100%)
    reportProgress(5, 'Generating objection handling...', 100);
    const objectionHandling = await generateObjectionHandling({
      companyName,
      meetingSubject,
      detailLevel: personaDetailLevel as 'Brief' | 'Standard' | 'Detailed',
      companyAnalysis,
      contactPersona
    });

    console.log('[GamePlanGenerator] Complete analysis generated successfully');

    const result = {
      companyAnalysis,
      contactPersona,
      influenceTactics,
      discussionPoints,
      objectionHandling,
      generatedAt: new Date().toISOString()
    };

    // Mark as completed in progress tracker
    if (analysisId) {
      progressTracker.setCompleted(analysisId, result);
    }

    return result;

  } catch (error) {
    console.error('[GamePlanGenerator] Complete analysis error:', error);

    // Report error to progress tracker
    if (analysisId) {
      progressTracker.setError(analysisId, error.message || 'Analysis generation failed');
    }

    throw error;
  }
}

/**
 * Validate Claude API configuration
 */
export function validateClaudeConfig(): { valid: boolean; error?: string } {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      valid: false,
      error: 'Claude API key not configured (ANTHROPIC_API_KEY)'
    };
  }
  return { valid: true };
}

/**
 * Export progress tracker for use in controllers
 */
export { progressTracker };
