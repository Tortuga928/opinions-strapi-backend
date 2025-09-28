/**
 * opinion service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::opinion.opinion', ({ strapi }) => ({
  async generateOpinion({ generationType, generationSource }) {
    // Generate quotes with attribution based on type and source
    const templates = {
      Celebrity: {
        News: [
          "\"Fame is a prison of other people's expectations.\" - Taylor Swift, Rolling Stone Interview",
          "\"Social media has created unrealistic standards for everyone, including celebrities.\" - Emma Stone, The Guardian",
          "\"The paparazzi culture has become more invasive than ever before.\" - Jennifer Lawrence, Vanity Fair"
        ],
        Research: [
          "\"Celebrity endorsements increase product sales by an average of 20%.\" - Dr. Sarah Johnson, Harvard Business Review",
          "\"Parasocial relationships with celebrities can fill social voids.\" - Prof. Mark Thompson, Journal of Media Psychology",
          "\"Celebrity worship syndrome affects 1 in 3 young adults.\" - Dr. Lisa Chen, American Psychological Association"
        ],
        Laws: [
          "\"Current privacy laws fail to protect public figures adequately.\" - Judge William Harris, California Law Review",
          "\"Celebrity image rights need federal protection standards.\" - Sen. Maria Rodriguez, Congressional Hearing",
          "\"The right to publicity varies too much between states.\" - Prof. Robert Kim, Yale Law Journal"
        ],
        Advertisements: [
          "\"Influencer marketing will reach $21 billion by 2025.\" - Marketing Week Report, Industry Analysis",
          "\"Authenticity in celebrity endorsements drives consumer trust.\" - Nielsen Study, Consumer Insights",
          "\"Disclosure requirements for sponsored content are poorly enforced.\" - FTC Commissioner, Press Release"
        ]
      },
      Politician: {
        News: [
          "\"Democracy requires constant vigilance from its citizens.\" - Sen. John Mitchell, CNN Interview",
          "\"Partisan gridlock is destroying our ability to govern.\" - Rep. Sarah Williams, Washington Post",
          "\"The media has become the fourth branch of government.\" - Gov. Michael Brown, NBC News"
        ],
        Research: [
          "\"Political polarization has reached historic levels in America.\" - Pew Research Center, Annual Report",
          "\"Social media echo chambers reinforce political biases.\" - MIT Study, Science Journal",
          "\"Trust in government is at an all-time low of 20%.\" - Gallup Poll, Public Trust Survey"
        ],
        Laws: [
          "\"Campaign finance reform is essential for democracy.\" - Justice Elena Carter, Supreme Court Dissent",
          "\"Term limits would reduce corruption and increase accountability.\" - Sen. David Lee, Senate Floor Speech",
          "\"Lobbying disclosure laws have too many loopholes.\" - Ethics Commissioner, Annual Report"
        ],
        Advertisements: [
          "\"Political ads should be held to the same standards as commercial ads.\" - FCC Chairman, Policy Statement",
          "\"Microtargeting in political advertising threatens privacy.\" - Privacy Advocate, Tech Committee Hearing",
          "\"Dark money in politics undermines transparency.\" - Campaign Finance Institute, Research Brief"
        ]
      },
      "Company Executive": {
        News: [
          "\"The average CEO makes 351 times the typical worker's salary.\" - Economic Policy Institute, Annual Report",
          "\"Diversity in leadership improves company performance by 35%.\" - McKinsey Study, Forbes",
          "\"Short-term thinking is killing American business.\" - Warren Buffett, Berkshire Hathaway Letter"
        ],
        Research: [
          "\"CEO turnover rates have increased 50% in the last decade.\" - Strategy& Study, Harvard Business Review",
          "\"Narcissistic CEOs take more risks but deliver volatile returns.\" - Stanford Research, Journal of Finance",
          "\"Executive overconfidence leads to poor acquisition decisions.\" - Wharton Study, Management Science"
        ],
        Laws: [
          "\"Say-on-pay votes should be binding, not advisory.\" - SEC Commissioner, Regulatory Proposal",
          "\"Clawback provisions for executive compensation need teeth.\" - Sen. Elizabeth Warren, Banking Committee",
          "\"Stock buybacks should be more heavily regulated.\" - Prof. William Lazonick, Harvard Law Review"
        ],
        Advertisements: [
          "\"CEO personal brands can impact stock prices by up to 10%.\" - Weber Shandwick Study, PR Week",
          "\"Authentic leadership communication drives employee engagement.\" - Gallup Research, Workplace Report",
          "\"Executive thought leadership influences B2B purchasing decisions.\" - LinkedIn Study, Marketing Insights"
        ]
      }
    };

    // Get random template based on type and source
    const typeTemplates = templates[generationType];
    if (!typeTemplates) {
      throw new Error(`Invalid generation type: ${generationType}`);
    }

    const sourceTemplates = typeTemplates[generationSource];
    if (!sourceTemplates) {
      throw new Error(`Invalid generation source: ${generationSource}`);
    }

    // Select random opinion from templates
    const randomIndex = Math.floor(Math.random() * sourceTemplates.length);
    const opinionText = sourceTemplates[randomIndex];

    // Get all categories to select a relevant one
    const categories = await strapi.entityService.findMany('api::category.category', {
      fields: ['id', 'name']
    });

    // Map categories based on generation type
    const categoryMapping = {
      Celebrity: ['Entertainment', 'Society', 'Media'],
      Politician: ['Politics', 'Government', 'Policy'],
      "Company Executive": ['Business', 'Economy', 'Corporate']
    };

    // Find matching category or use first available
    let selectedCategory = categories[0];
    const preferredCategories = categoryMapping[generationType] || [];

    for (const catName of preferredCategories) {
      const found = categories.find(cat =>
        cat.name.toLowerCase().includes(catName.toLowerCase()) ||
        catName.toLowerCase().includes(cat.name.toLowerCase())
      );
      if (found) {
        selectedCategory = found;
        break;
      }
    }

    return {
      statement: opinionText,
      category: selectedCategory?.id || categories[0]?.id
    };
  }
}));