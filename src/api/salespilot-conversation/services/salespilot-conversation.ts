/**
 * SalesPilot Conversation Service
 *
 * Manages conversation flow for gathering game plan inputs
 * Uses structured step-based state machine with Claude API for natural responses
 * Integrates Google Custom Search for URL finding
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Step Configuration - Defines conversation flow structure
 */
const STEP_CONFIG = [
  // Step 1: Company Name
  {
    step: 'primary_company_name',
    question: 'Welcome! I\'ll help you create a personalized sales meeting game plan. Let\'s start with the basics - what\'s the name of the company you\'ll be meeting with?',
    field: 'primary_company_name',
    required: true,
    hasButtons: false
  },
  // Step 2: Company Domain (moved up)
  {
    step: 'primary_company_domain',
    question: 'Great! Do you have the company\'s website domain? (You can type it or skip this)',
    field: 'primary_company_domain',
    required: false,
    hasButtons: false
  },
  // Step 3: Primary Contact Name
  {
    step: 'primary_contact_name',
    question: 'Perfect! Who\'s the primary contact you\'ll be meeting with? (Name)',
    field: 'primary_contact_name',
    required: true,
    hasButtons: false
  },
  // Step 4: Primary Contact Title (moved up)
  {
    step: 'primary_contact_title',
    question: 'What\'s their title or role? (Optional - you can skip this)',
    field: 'primary_contact_title',
    required: false,
    hasButtons: false
  },
  // Step 5: Primary Contact LinkedIn (moved up)
  {
    step: 'primary_contact_linkedin',
    question: 'Do you have their LinkedIn profile URL? (Optional - you can skip this)',
    field: 'primary_contact_linkedin',
    required: false,
    hasButtons: false
  },
  // Step 6: Additional Stakeholders Initial (NEW - Yes/No question)
  {
    step: 'additional_stakeholders_initial',
    question: 'Are there any additional stakeholders or attendees I should know about?',
    field: null, // No field - this controls loop entry
    required: false,
    hasButtons: true,
    options: ['Yes', 'No'],
    isLoopEntry: true
  },
  // Step 7: Stakeholder Name (LOOP - entry point)
  {
    step: 'stakeholder_name',
    question: 'What\'s the name of the stakeholder?',
    field: null, // Handled specially in loop
    required: true,
    hasButtons: false,
    isLoopStep: true
  },
  // Step 8: Stakeholder LinkedIn (LOOP - optional)
  {
    step: 'stakeholder_linkedin',
    question: 'Do you have their LinkedIn profile URL? (Optional - you can skip this)',
    field: null, // Handled specially in loop
    required: false,
    hasButtons: false,
    isLoopStep: true
  },
  // Step 9: More Stakeholders (LOOP - continuation check)
  {
    step: 'stakeholder_more',
    question: 'Would you like to add another stakeholder?',
    field: null, // No field - this controls loop continuation
    required: false,
    hasButtons: true,
    options: ['Yes', 'No'],
    isLoopContinuation: true
  },
  // Step 10: Meeting Subject (moved from step 3)
  {
    step: 'meeting_subject',
    question: 'Perfect! What\'s the primary subject or purpose of your upcoming meeting?',
    field: 'meeting_subject',
    required: true,
    hasButtons: true,
    options: [
      'Product Demo',
      'Discovery Call',
      'Proposal Presentation',
      'Follow-up Meeting',
      'Contract Negotiation',
      'Solution Review',
      'Renewal Discussion',
      'Expansion Opportunity',
      'Problem Resolution',
      'Executive Briefing'
    ]
  },
  // Step 11: Desired Outcome
  {
    step: 'desired_outcome',
    question: 'What\'s your primary desired outcome for this meeting?',
    field: 'desired_outcome',
    required: true,
    hasButtons: true,
    options: [
      'Schedule Follow-up',
      'Close Deal',
      'Get Budget Approval',
      'Identify Decision Makers',
      'Understand Pain Points',
      'Expand Relationship',
      'Secure Next Steps',
      'Get Technical Buy-in'
    ]
  },
  // Step 12: Research Depth
  {
    step: 'research_depth',
    question: 'How much research would you like me to perform on this company and contact?',
    field: 'research_depth',
    required: true,
    hasButtons: true,
    options: ['Quick', 'Standard', 'Deep']
  },
  // Step 13: Persona Detail Level
  {
    step: 'persona_detail_level',
    question: 'How detailed should the persona analysis be?',
    field: 'persona_detail_level',
    required: true,
    hasButtons: true,
    options: ['Brief', 'Standard', 'Detailed']
  },
  // Step 14: Influence Framework
  {
    step: 'influence_framework',
    question: 'Which influence framework would you like me to use for recommendations?',
    field: 'influence_framework',
    required: true,
    hasButtons: true,
    options: ['Hybrid', 'Cialdini', 'SPIN', 'Challenger', 'Sandler']
  },
  // Step 15: Materials Selection
  {
    step: 'materials_selection',
    question: 'Which materials would you like me to generate? (You can select multiple)',
    field: 'selected_materials',
    required: true,
    hasButtons: true,
    multiSelect: true,
    options: ['agenda', 'presentation', 'preMeetingEmail', 'postMeetingEmail']
  },
  // Step 16: Template Selection
  {
    step: 'template_selection',
    question: 'What template style would you prefer for the materials?',
    field: 'template_choice',
    required: true,
    hasButtons: true,
    options: ['Modern', 'Classic', 'Minimal', 'Corporate', 'Creative']
  },
  // Step 17: Complete
  {
    step: 'complete',
    question: 'Perfect! I have all the information I need. I\'ll now create your personalized sales meeting game plan.',
    field: null,
    required: false,
    hasButtons: false
  }
];

const CONVERSATION_SYSTEM_PROMPT = `You are an AI assistant helping users create sales meeting game plans.

Your role is to acknowledge user inputs and provide brief, encouraging responses (1-2 sentences max).

Guidelines:
- Be warm and professional
- Acknowledge what the user provided
- Don't ask follow-up questions (the system handles progression)
- Keep responses under 2 sentences
- Use encouraging language

Examples:
User: "I want to discuss their software needs"
Response: "Excellent! Understanding their software needs is a great meeting focus."

User: "Acme Corporation"
Response: "Got it! I'll research Acme Corporation for you."

User: "Quick"
Response: "Perfect! I'll do a quick research sweep to get you the essentials."`;

/**
 * Helper function to detect negative responses
 * Liberal keyword matching for user convenience
 */
function isNegativeResponse(input: string): boolean {
  const negativeKeywords = [
    'no', 'none', 'no more', 'done', 'finished',
    "that's all", 'nope', 'n/a', 'skip', 'pass'
  ];

  const normalizedInput = input.toLowerCase().trim();
  return negativeKeywords.some(keyword => normalizedInput.includes(keyword));
}

/**
 * Helper function to detect positive responses
 */
function isPositiveResponse(input: string): boolean {
  const positiveKeywords = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay'];
  const normalizedInput = input.toLowerCase().trim();
  return positiveKeywords.some(keyword => normalizedInput === keyword || normalizedInput.startsWith(keyword + ' '));
}

export default () => ({
  /**
   * Get step configuration by step name
   */
  getStepConfig(stepName: string) {
    return STEP_CONFIG.find(s => s.step === stepName);
  },

  /**
   * Get next step in conversation flow (with stakeholder loop logic)
   */
  getNextStep(currentStep: string, userInput: string, collectedData: any) {
    const currentIndex = STEP_CONFIG.findIndex(s => s.step === currentStep);

    if (currentIndex === -1) {
      return STEP_CONFIG[0]; // Start from beginning if invalid step
    }

    const currentConfig = STEP_CONFIG[currentIndex];

    // LOOP ENTRY: additional_stakeholders_initial (Yes/No)
    if (currentConfig.isLoopEntry) {
      if (isPositiveResponse(userInput)) {
        // User said "Yes" → Enter loop (go to stakeholder_name)
        return this.getStepConfig('stakeholder_name');
      } else {
        // User said "No" → Skip loop entirely (go to meeting_subject)
        return this.getStepConfig('meeting_subject');
      }
    }

    // LOOP CONTINUATION: stakeholder_more (Yes/No)
    if (currentConfig.isLoopContinuation) {
      if (isPositiveResponse(userInput)) {
        // User said "Yes" → Repeat loop (go back to stakeholder_name)
        return this.getStepConfig('stakeholder_name');
      } else {
        // User said "No" → Exit loop (go to meeting_subject)
        return this.getStepConfig('meeting_subject');
      }
    }

    // LOOP STEPS: stakeholder_name and stakeholder_linkedin
    if (currentConfig.isLoopStep) {
      // Inside loop: move to next step in loop sequence
      // stakeholder_name → stakeholder_linkedin → stakeholder_more
      return STEP_CONFIG[currentIndex + 1] || STEP_CONFIG[currentIndex];
    }

    // REGULAR STEPS: Check if user wants to skip optional field
    if (!currentConfig.required && isNegativeResponse(userInput)) {
      // Skip to next step
      return STEP_CONFIG[currentIndex + 1] || STEP_CONFIG[currentIndex];
    }

    // For multi-select fields, check if user provided values
    if (currentConfig.multiSelect) {
      if (userInput.trim().length > 0) {
        return STEP_CONFIG[currentIndex + 1] || STEP_CONFIG[currentIndex];
      }
    }

    // Default: Move to next step
    return STEP_CONFIG[currentIndex + 1] || STEP_CONFIG[currentIndex];
  },

  /**
   * Process user input and extract value(s)
   */
  processUserInput(userInput: string, stepConfig: any) {
    const trimmedInput = userInput.trim();

    // Handle multi-select (bullet list format)
    if (stepConfig.multiSelect) {
      // Check if input is in bullet list format
      if (trimmedInput.includes('•') || trimmedInput.includes('\n')) {
        const values = trimmedInput
          .split('\n')
          .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
          .filter(line => line.length > 0);
        return values;
      }
      // Single value for multi-select
      return [trimmedInput];
    }

    // Single select
    return trimmedInput;
  },

  /**
   * Process conversation and manage state
   */
  async processConversation(message: string, conversationState: any, userId: number) {
    try {
      strapi.log.info(`Processing conversation for user ${userId}`);

      // Initialize conversation state if not provided
      const state = conversationState || {
        step: 'primary_company_name',
        collectedData: {},
        messageHistory: [],
        // Stakeholder loop tracking
        inStakeholderLoop: false,
        currentStakeholder: {},
        stakeholders: [],
        // Step history for Go Back functionality (PHASE 3)
        stepHistory: []
      };

      // Ensure stakeholder tracking exists (for existing conversations)
      if (!state.hasOwnProperty('stakeholders')) {
        state.stakeholders = [];
        state.currentStakeholder = {};
        state.inStakeholderLoop = false;
      }

      // Ensure step history exists (for existing conversations)
      if (!state.hasOwnProperty('stepHistory')) {
        state.stepHistory = [];
      }

      // PHASE 3: Handle "Go Back" action
      if (message === '__GO_BACK__') {
        strapi.log.info('Go Back action detected');

        if (state.stepHistory.length === 0) {
          // Already at first question, can't go back further
          const stepInfo = this.calculateStepInfo(state);
          return {
            message: 'You are already at the first question.',
            conversationState: state,
            progress: 0,
            currentStep: stepInfo.currentStep,
            totalSteps: stepInfo.totalSteps,
            complete: false,
            collectedData: state.collectedData,
            canGoBack: false
          };
        }

        // Pop the last step from history
        const previousStepState = state.stepHistory.pop();

        // Restore previous state
        state.step = previousStepState.step;
        state.collectedData = { ...previousStepState.collectedData };
        state.stakeholders = [...(previousStepState.stakeholders || [])];
        state.currentStakeholder = { ...(previousStepState.currentStakeholder || {}) };
        state.inStakeholderLoop = previousStepState.inStakeholderLoop || false;

        // Get the question for the previous step
        const previousStepConfig = this.getStepConfig(state.step);
        const previousQuestion = previousStepConfig.question;

        // Clear the answer for this question so user can re-answer
        if (previousStepConfig.field) {
          delete state.collectedData[previousStepConfig.field];
          strapi.log.info(`Cleared answer for field: ${previousStepConfig.field}`);
        }

        // Calculate step info
        const stepInfo = this.calculateStepInfo(state);

        strapi.log.info(`Went back to step: ${state.step}, step ${stepInfo.currentStep} of ${stepInfo.totalSteps}`);

        return {
          message: previousQuestion,
          conversationState: state,
          progress: this.calculateProgress(state.collectedData),
          currentStep: stepInfo.currentStep,
          totalSteps: stepInfo.totalSteps,
          complete: false,
          collectedData: state.collectedData,
          canGoBack: state.stepHistory.length > 0
        };
      }

      // Get current step configuration
      const currentStepConfig = this.getStepConfig(state.step);

      if (!currentStepConfig) {
        throw new Error(`Invalid step: ${state.step}`);
      }

      // Special case: first step (first message from user)
      if (state.step === 'primary_company_name' && state.messageHistory.length === 0) {
        // Just send welcome message, don't process user input yet
        const welcomeResponse = currentStepConfig.question;

        state.messageHistory.push({
          role: 'assistant',
          content: welcomeResponse,
          timestamp: new Date().toISOString()
        });

        // Calculate step information for initial state
        const stepInfo = this.calculateStepInfo(state);

        return {
          message: welcomeResponse,
          conversationState: state,
          progress: 0,
          currentStep: stepInfo.currentStep,
          totalSteps: stepInfo.totalSteps,
          complete: false,
          collectedData: state.collectedData,
          canGoBack: false // PHASE 3: Can't go back from first question
        };
      }

      // Add user message to history
      state.messageHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // Process and store user input (no validation - buttons are just convenience)
      if (currentStepConfig.field) {
        const processedValue = this.processUserInput(message, currentStepConfig);
        state.collectedData[currentStepConfig.field] = processedValue;
      }

      // STAKEHOLDER LOOP DATA HANDLING
      if (state.step === 'additional_stakeholders_initial') {
        // Entering or skipping loop
        if (isPositiveResponse(message)) {
          state.inStakeholderLoop = true;
          state.currentStakeholder = {}; // Reset for new stakeholder
        }
      } else if (state.step === 'stakeholder_name') {
        // Store stakeholder name
        state.currentStakeholder.name = message.trim();
      } else if (state.step === 'stakeholder_linkedin') {
        // Store stakeholder linkedin (or null if skipped)
        state.currentStakeholder.linkedin = isNegativeResponse(message) ? null : message.trim();
        // Don't push to array yet - wait for stakeholder_more response
      } else if (state.step === 'stakeholder_more') {
        // Before asking "add another?", save the current stakeholder
        if (state.currentStakeholder.name) {
          state.stakeholders.push({
            name: state.currentStakeholder.name,
            linkedin: state.currentStakeholder.linkedin || null
          });
          state.currentStakeholder = {}; // Reset for potential next stakeholder
        }

        // Check if user wants to add more or exit loop
        if (isNegativeResponse(message)) {
          // Exiting loop - store stakeholders in collectedData
          state.inStakeholderLoop = false;
          state.collectedData.additional_stakeholders = state.stakeholders.length > 0
            ? state.stakeholders
            : [];
        }
        // If positive, loop continues (getNextStep will handle routing back to stakeholder_name)
      }

      // Get next step
      const nextStepConfig = this.getNextStep(state.step, message, state.collectedData);
      const isComplete = nextStepConfig.step === 'complete';

      // Generate AI acknowledgment using Claude
      let acknowledgment;
      try {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });

        const completion = await anthropic.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219',
          max_tokens: 150,
          system: CONVERSATION_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Question asked: "${currentStepConfig.question}"\nUser answered: "${message}"\n\nAcknowledge this answer briefly and encouragingly (1-2 sentences max). Be specific to what they provided.`
            }
          ]
        });

        acknowledgment = completion.content[0].type === 'text'
          ? completion.content[0].text
          : 'Got it!';

      } catch (aiError) {
        strapi.log.warn('Claude API error, using fallback acknowledgment:', aiError.message);
        acknowledgment = 'Got it!';
      }

      // Build response message: acknowledgment + next question
      const responseMessage = isComplete
        ? nextStepConfig.question
        : `${acknowledgment}\n\n${nextStepConfig.question}`;

      // Update conversation state
      state.messageHistory.push({
        role: 'assistant',
        content: responseMessage,
        timestamp: new Date().toISOString()
      });

      // PHASE 3: Save current step state to history before advancing
      state.stepHistory.push({
        step: state.step,
        collectedData: { ...state.collectedData },
        stakeholders: [...(state.stakeholders || [])],
        currentStakeholder: { ...(state.currentStakeholder || {}) },
        inStakeholderLoop: state.inStakeholderLoop || false
      });

      // Update step to next step
      state.step = nextStepConfig.step;

      // Calculate progress
      const progress = this.calculateProgress(state.collectedData);

      // Calculate step information
      const stepInfo = this.calculateStepInfo(state);

      // Return response with updated state
      return {
        message: responseMessage,
        conversationState: state,
        progress,
        currentStep: stepInfo.currentStep,
        totalSteps: stepInfo.totalSteps,
        complete: isComplete,
        collectedData: state.collectedData,
        canGoBack: state.stepHistory.length > 0 // PHASE 3: Indicate if user can go back
      };

    } catch (error) {
      strapi.log.error('Conversation processing error:', {
        message: error.message,
        userId
      });
      throw error;
    }
  },

  /**
   * Find URLs using Google Custom Search API
   */
  async findUrls(query: string, searchType: 'linkedin' | 'company', userId: number) {
    try {
      strapi.log.info(`Finding URLs for user ${userId}: ${searchType} - ${query}`);

      // Check if Google Custom Search is configured
      if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
        throw new Error('Google Custom Search is not configured');
      }

      // Build search query based on type
      const searchQuery = searchType === 'linkedin'
        ? `site:linkedin.com/in ${query}`
        : `${query} company website`;

      // Call Google Custom Search API
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(searchQuery)}&num=5`
      );

      if (!response.ok) {
        const errorText = await response.text();
        strapi.log.error('Google Search API error:', errorText);
        throw new Error('Search API request failed');
      }

      const data = await response.json() as any;

      // Extract and format results
      const results = (data.items || []).map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet
      }));

      strapi.log.info(`Found ${results.length} results for ${searchType} search: ${query}`);

      return {
        query,
        searchType,
        results,
        count: results.length
      };

    } catch (error) {
      strapi.log.error('URL finding error:', {
        message: error.message,
        userId,
        query,
        searchType
      });
      throw error;
    }
  },

  /**
   * Build conversation context from state
   */
  buildConversationContext(state: any): string {
    const context = [];

    // Add current step
    context.push(`Current step: ${state.step}`);

    // Add collected data
    if (Object.keys(state.collectedData).length > 0) {
      context.push(`\nCollected data so far:`);
      for (const [key, value] of Object.entries(state.collectedData)) {
        context.push(`- ${key}: ${value}`);
      }
    }

    // Add recent message history (last 5 messages)
    const recentMessages = state.messageHistory.slice(-5);
    if (recentMessages.length > 0) {
      context.push(`\nRecent conversation:`);
      for (const msg of recentMessages) {
        context.push(`${msg.role}: ${msg.content}`);
      }
    }

    return context.join('\n');
  },

  /**
   * Calculate progress percentage based on collected data
   */
  calculateProgress(collectedData: any): number {
    const requiredFields = [
      'meeting_subject',
      'primary_company_name',
      'primary_contact_name',
      'desired_outcome',
      'research_depth',
      'persona_detail_level',
      'influence_framework',
      'selected_materials',
      'template_choice'
    ];

    const collectedCount = requiredFields.filter(
      field => collectedData[field] !== undefined && collectedData[field] !== null
    ).length;

    return Math.round((collectedCount / requiredFields.length) * 100);
  },

  /**
   * Calculate current step number and total steps
   * Step count is dynamic based on stakeholder loop
   */
  calculateStepInfo(state: any): { currentStep: number, totalSteps: number } {
    // Base steps (excluding loop-related steps)
    const baseSteps = [
      'primary_company_name',           // 1
      'primary_company_domain',         // 2
      'primary_contact_name',           // 3
      'primary_contact_title',          // 4
      'primary_contact_linkedin',       // 5
      'additional_stakeholders_initial', // 6
      'meeting_subject',                // 7 (or varies if in loop)
      'desired_outcome',                // 8 (or varies)
      'research_depth',                 // 9 (or varies)
      'persona_detail_level',           // 10 (or varies)
      'influence_framework',            // 11 (or varies)
      'materials_selection',            // 12 (or varies)
      'template_selection'              // 13 (or varies)
    ];

    // Loop steps (3 steps per stakeholder)
    const loopSteps = [
      'stakeholder_name',
      'stakeholder_linkedin',
      'stakeholder_more'
    ];

    // Count completed stakeholders
    const completedStakeholders = state.stakeholders ? state.stakeholders.length : 0;

    // Calculate total steps
    // If user hasn't answered additional_stakeholders_initial yet, assume no stakeholders (13 total)
    // Once they enter the loop, add 3 steps per stakeholder
    const inLoop = state.inStakeholderLoop === true;
    const hasAnsweredStakeholderQuestion = state.collectedData.hasOwnProperty('additional_stakeholders') || inLoop;

    let totalSteps = 13; // Base: all non-loop steps

    if (hasAnsweredStakeholderQuestion && (completedStakeholders > 0 || inLoop)) {
      // Add 3 steps per completed stakeholder
      totalSteps = 13 + (completedStakeholders * 3);

      // If currently in the loop (adding another stakeholder), add 3 more
      if (inLoop && (state.step === 'stakeholder_name' || state.step === 'stakeholder_linkedin' || state.step === 'stakeholder_more')) {
        totalSteps += 3;
      }
    }

    // Calculate current step number
    let currentStep = 1;

    // Map step to step number
    const currentStepName = state.step;

    // Before stakeholder loop
    if (currentStepName === 'primary_company_name') currentStep = 1;
    else if (currentStepName === 'primary_company_domain') currentStep = 2;
    else if (currentStepName === 'primary_contact_name') currentStep = 3;
    else if (currentStepName === 'primary_contact_title') currentStep = 4;
    else if (currentStepName === 'primary_contact_linkedin') currentStep = 5;
    else if (currentStepName === 'additional_stakeholders_initial') currentStep = 6;

    // Stakeholder loop steps
    else if (currentStepName === 'stakeholder_name') {
      currentStep = 7 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'stakeholder_linkedin') {
      currentStep = 8 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'stakeholder_more') {
      currentStep = 9 + (completedStakeholders * 3);
    }

    // After stakeholder loop (or if skipped)
    else if (currentStepName === 'meeting_subject') {
      currentStep = 7 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'desired_outcome') {
      currentStep = 8 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'research_depth') {
      currentStep = 9 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'persona_detail_level') {
      currentStep = 10 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'influence_framework') {
      currentStep = 11 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'materials_selection') {
      currentStep = 12 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'template_selection') {
      currentStep = 13 + (completedStakeholders * 3);
    }
    else if (currentStepName === 'complete') {
      currentStep = totalSteps; // Final step
    }

    return {
      currentStep,
      totalSteps
    };
  },

  /**
   * Perform web research using web-research service
   */
  async performWebResearch(params: any, userId: number) {
    try {
      strapi.log.info(`Starting web research for user ${userId}: ${params.researchDepth} on ${params.companyName || params.companyDomain}`);

      // Import web research service
      const { performWebResearch, validateResearchConfig } = require('./web-research');

      // Validate research configuration
      const configValidation = validateResearchConfig();
      if (!configValidation.valid) {
        throw new Error(configValidation.error);
      }

      // Convert research depth to lowercase for service
      const depthMap = {
        'Quick': 'quick',
        'Standard': 'standard',
        'Deep': 'deep'
      };
      const depth = depthMap[params.researchDepth] || 'standard';

      // Perform research with progress tracking
      const results = await performWebResearch({
        companyName: params.companyName,
        companyDomain: params.companyDomain,
        contactName: params.contactName,
        contactLinkedIn: params.contactLinkedIn,
        industry: params.industry,
        depth: depth,
        additionalCompanies: params.additionalParties?.companies || [],
        additionalContacts: params.additionalParties?.contacts || []
      });

      strapi.log.info(`Research completed for user ${userId}: ${results.totalQueries} queries executed`);

      return {
        success: true,
        data: results,
        researchDepth: params.researchDepth,
        timestamp: results.timestamp
      };

    } catch (error) {
      strapi.log.error('Web research error:', {
        message: error.message,
        userId,
        params
      });

      // Provide helpful error message for missing API keys
      if (error.message?.includes('not configured')) {
        throw new Error('Google Custom Search API is not configured. Please configure GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables.');
      }

      throw error;
    }
  },

  /**
   * Generate complete game plan analysis using AI
   */
  async generateGamePlanAnalysis(params: any, userId: number, existingAnalysisId?: string) {
    try {
      strapi.log.info(`Starting analysis generation for user ${userId}: ${params.companyName} / ${params.contactName}`);

      // Import game plan generator service
      const {
        generateCompleteAnalysis,
        validateClaudeConfig
      } = require('./game-plan-generator');

      // Validate Claude API configuration
      const configValidation = validateClaudeConfig();
      if (!configValidation.valid) {
        throw new Error(configValidation.error);
      }

      // Use provided analysis ID or generate new one
      const { progressTracker } = await import('./game-plan-generator');
      const analysisId = existingAnalysisId || progressTracker.generateAnalysisId();

      // Initialize progress tracking only if not already initialized
      if (!existingAnalysisId) {
        progressTracker.initializeProgress(analysisId);
      }

      strapi.log.info(`[AnalysisGeneration] Using ID: ${analysisId}`);

      // Parse globalStartTime if provided (convert from ISO string to Date)
      const globalStartTime = params.globalStartTime
        ? new Date(params.globalStartTime)
        : undefined;

      // Generate complete analysis
      const analysis = await generateCompleteAnalysis({
        companyName: params.companyName,
        contactName: params.contactName,
        contactTitle: params.contactTitle,
        industry: params.industry,
        meetingSubject: params.meetingSubject,
        desiredOutcome: params.desiredOutcome,
        personaDetailLevel: params.personaDetailLevel,
        influenceFramework: params.influenceFramework,
        researchData: params.researchData,
        selectedMaterials: params.selectedMaterials, // Pass selected materials for Phase 7
        templateChoice: params.templateChoice, // Pass template choice for PDFs
        analysisId, // Pass analysisId for progress tracking
        globalStartTime, // Pass global start time from research phase 1
        onProgress: (stage, percentage) => {
          strapi.log.info(`[AnalysisGeneration] ${stage} (${percentage}%)`);
        }
      });

      strapi.log.info(`Analysis generation completed for user ${userId}`);

      return {
        success: true,
        data: analysis,
        timestamp: analysis.generatedAt
      };

    } catch (error) {
      strapi.log.error('Analysis generation error:', {
        message: error.message,
        userId,
        params
      });

      // Provide helpful error message for missing API key
      if (error.message?.includes('API key')) {
        throw new Error('Claude API is not configured. Please configure ANTHROPIC_API_KEY environment variable.');
      }

      throw error;
    }
  }
});
