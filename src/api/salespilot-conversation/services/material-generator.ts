/**
 * material-generator.ts
 *
 * Material Generation Service for SalesPilot AI
 * Generates professional email templates and text content using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GamePlan {
  primaryCompanyName: string;
  primaryContactName: string;
  primaryContactTitle?: string;
  meetingSubject: string;
  meetingDate?: string;
  desiredOutcome: string;
  companyAnalysis: string;
  contactPersona: string;
  influenceTactics: string;
  objectionHandling: string;
  discussionPoints: string;
}

interface EmailResult {
  subject: string;
  body: string;
  generatedAt: string;
}

/**
 * Generate pre-meeting email template
 */
export async function generatePreMeetingEmail(gamePlan: GamePlan): Promise<EmailResult> {
  const prompt = `You are a professional business communications expert. Generate a pre-meeting email for the following context:

**Meeting Details:**
- Company: ${gamePlan.primaryCompanyName}
- Contact: ${gamePlan.primaryContactName}${gamePlan.primaryContactTitle ? `, ${gamePlan.primaryContactTitle}` : ''}
- Subject: ${gamePlan.meetingSubject}
${gamePlan.meetingDate ? `- Date: ${gamePlan.meetingDate}` : ''}
- Desired Outcome: ${gamePlan.desiredOutcome}

**Company Context (for personalization):**
${gamePlan.companyAnalysis.substring(0, 1000)}

**Contact Persona (for tone):**
${gamePlan.contactPersona.substring(0, 500)}

**Key Discussion Points:**
${gamePlan.discussionPoints.substring(0, 1000)}

Generate a professional pre-meeting email that includes:
1. A compelling subject line (on first line starting with "Subject:")
2. Personalized greeting
3. Meeting confirmation${gamePlan.meetingDate ? '' : ' (note: specific date will be added later)'}
4. Brief agenda preview (3-4 key topics from discussion points)
5. Value proposition teaser (why this meeting is valuable based on company context)
6. Professional closing

**Tone:** Professional, consultative, personalized to the contact's communication style
**Length:** 250-400 words
**Format:** Plain text, ready to copy into email

Generate the email now:`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    const fullText = content.type === 'text' ? content.text : '';

    // Extract subject line
    const subjectMatch = fullText.match(/Subject:\s*(.+?)(?:\n|$)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : `Meeting: ${gamePlan.meetingSubject}`;

    // Remove subject line from body
    const body = fullText.replace(/Subject:\s*.+?(?:\n|$)/i, '').trim();

    return {
      subject,
      body,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating pre-meeting email:', error);
    throw new Error(`Failed to generate pre-meeting email: ${error.message}`);
  }
}

/**
 * Generate post-meeting email template with placeholders
 */
export async function generatePostMeetingEmail(gamePlan: GamePlan): Promise<EmailResult> {
  const prompt = `You are a professional business communications expert. Generate a post-meeting follow-up email template for the following context:

**Meeting Details:**
- Company: ${gamePlan.primaryCompanyName}
- Contact: ${gamePlan.primaryContactName}${gamePlan.primaryContactTitle ? `, ${gamePlan.primaryContactTitle}` : ''}
- Subject: ${gamePlan.meetingSubject}
- Desired Outcome: ${gamePlan.desiredOutcome}

**Discussion Points Covered:**
${gamePlan.discussionPoints.substring(0, 1000)}

**Contact Persona (for tone):**
${gamePlan.contactPersona.substring(0, 500)}

Generate a professional post-meeting follow-up email that includes:
1. A compelling subject line (on first line starting with "Subject:")
2. Thank you for the meeting
3. Meeting summary section with [PLACEHOLDER: User will fill in specific details discussed]
4. Key discussion points covered (bullet points based on the discussion points)
5. Agreed next steps section with [PLACEHOLDER: User will fill in agreed actions]
6. Action items section with [PLACEHOLDER: User will fill in specific action items]
7. Follow-up timeline (suggest 1-2 weeks)
8. Professional closing with call to action

**Important:**
- Include clear [PLACEHOLDER] markers where the user needs to fill in specific details
- These placeholders should be obvious and instructive
- Example: "[PLACEHOLDER: Describe the main points discussed about the cloud migration project]"

**Tone:** Professional, appreciative, action-oriented
**Length:** 300-450 words
**Format:** Plain text with placeholders, ready to customize and send

Generate the email now:`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    const fullText = content.type === 'text' ? content.text : '';

    // Extract subject line
    const subjectMatch = fullText.match(/Subject:\s*(.+?)(?:\n|$)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : `Follow-up: ${gamePlan.meetingSubject}`;

    // Remove subject line from body
    const body = fullText.replace(/Subject:\s*.+?(?:\n|$)/i, '').trim();

    return {
      subject,
      body,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating post-meeting email:', error);
    throw new Error(`Failed to generate post-meeting email: ${error.message}`);
  }
}

/**
 * Main service export
 */
export default {
  generatePreMeetingEmail,
  generatePostMeetingEmail
};
