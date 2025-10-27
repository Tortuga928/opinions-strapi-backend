/**
 * pdf-generator.ts
 *
 * PDF Generation Service for SalesPilot AI
 * Generates professional PDF documents (agendas and presentations) using Puppeteer
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

/**
 * Dynamic import for marked (ES Module)
 */
async function parseMarkdown(markdown: string): Promise<string> {
  const { marked } = await import('marked');
  return marked(markdown);
}

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

interface PDFTemplate {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

interface PDFResult {
  fileUrl: string;
  filename: string;
  filepath: string;
  generatedAt: string;
}

/**
 * Template System - 5 Professional Styles
 */
export const templates: Record<string, PDFTemplate> = {
  modern: {
    name: 'Modern',
    colors: {
      primary: '#2563eb',     // Blue
      secondary: '#64748b',   // Slate
      accent: '#3b82f6',      // Light Blue
      text: '#1e293b',        // Dark Slate
      background: '#ffffff'
    },
    fonts: {
      heading: "'Inter', 'Helvetica Neue', sans-serif",
      body: "'Inter', 'Helvetica Neue', sans-serif"
    }
  },
  classic: {
    name: 'Classic',
    colors: {
      primary: '#1e3a8a',     // Dark Blue
      secondary: '#475569',   // Cool Gray
      accent: '#0369a1',      // Sky Blue
      text: '#0f172a',        // Slate 900
      background: '#fefce8'   // Yellow 50
    },
    fonts: {
      heading: "'Georgia', 'Times New Roman', serif",
      body: "'Georgia', 'Times New Roman', serif"
    }
  },
  minimal: {
    name: 'Minimal',
    colors: {
      primary: '#000000',     // Black
      secondary: '#6b7280',   // Gray 500
      accent: '#374151',      // Gray 700
      text: '#111827',        // Gray 900
      background: '#ffffff'
    },
    fonts: {
      heading: "'Helvetica Neue', 'Arial', sans-serif",
      body: "'Helvetica Neue', 'Arial', sans-serif"
    }
  },
  corporate: {
    name: 'Corporate',
    colors: {
      primary: '#0c4a6e',     // Sky 900
      secondary: '#0e7490',   // Cyan 700
      accent: '#06b6d4',      // Cyan 500
      text: '#164e63',        // Cyan 900
      background: '#f0f9ff'   // Sky 50
    },
    fonts: {
      heading: "'Arial', 'Helvetica', sans-serif",
      body: "'Arial', 'Helvetica', sans-serif"
    }
  },
  creative: {
    name: 'Creative',
    colors: {
      primary: '#7c3aed',     // Violet 600
      secondary: '#a855f7',   // Purple 500
      accent: '#c084fc',      // Purple 400
      text: '#581c87',        // Purple 900
      background: '#faf5ff'   // Purple 50
    },
    fonts: {
      heading: "'Montserrat', 'Helvetica', sans-serif",
      body: "'Open Sans', 'Helvetica', sans-serif"
    }
  }
};

/**
 * Get common CSS styles for all PDFs
 */
function getCommonStyles(template: PDFTemplate): string {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@600;700&family=Open+Sans:wght@400;600&display=swap');

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: ${template.fonts.body};
        color: ${template.colors.text};
        background: ${template.colors.background};
        line-height: 1.6;
        padding: 40px;
      }

      h1, h2, h3, h4 {
        font-family: ${template.fonts.heading};
        color: ${template.colors.primary};
        margin-bottom: 1rem;
      }

      h1 {
        font-size: 32px;
        font-weight: 700;
        border-bottom: 3px solid ${template.colors.primary};
        padding-bottom: 0.5rem;
        margin-bottom: 1.5rem;
      }

      h2 {
        font-size: 24px;
        font-weight: 600;
        margin-top: 2rem;
        margin-bottom: 1rem;
      }

      h3 {
        font-size: 18px;
        font-weight: 600;
        margin-top: 1.5rem;
        color: ${template.colors.secondary};
      }

      p {
        margin-bottom: 1rem;
        font-size: 14px;
      }

      ul, ol {
        margin-left: 1.5rem;
        margin-bottom: 1rem;
      }

      li {
        margin-bottom: 0.5rem;
        font-size: 14px;
      }

      .header {
        text-align: center;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid ${template.colors.secondary};
      }

      .company-name {
        font-size: 28px;
        color: ${template.colors.primary};
        font-weight: 700;
        margin-bottom: 0.5rem;
      }

      .contact-name {
        font-size: 18px;
        color: ${template.colors.secondary};
        font-weight: 600;
      }

      .meeting-date {
        font-size: 14px;
        color: ${template.colors.text};
        margin-top: 0.5rem;
      }

      .section {
        margin-bottom: 2rem;
        page-break-inside: avoid;
      }

      .highlight {
        background-color: ${template.colors.accent}20;
        padding: 1rem;
        border-left: 4px solid ${template.colors.accent};
        margin: 1rem 0;
      }

      .footer {
        margin-top: 3rem;
        padding-top: 1rem;
        border-top: 1px solid ${template.colors.secondary};
        text-align: center;
        font-size: 12px;
        color: ${template.colors.secondary};
      }

      @media print {
        body {
          padding: 20px;
        }
      }
    </style>
  `;
}

/**
 * Generate Meeting Agenda PDF
 */
export async function generateAgendaPDF(
  gamePlan: GamePlan,
  templateName: string = 'modern'
): Promise<PDFResult> {
  const template = templates[templateName] || templates.modern;

  // Parse discussion points from markdown
  const discussionPointsHtml = await parseMarkdown(gamePlan.discussionPoints);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${getCommonStyles(template)}
    </head>
    <body>
      <div class="header">
        <div class="company-name">${gamePlan.primaryCompanyName}</div>
        <div class="contact-name">${gamePlan.primaryContactName}${gamePlan.primaryContactTitle ? `, ${gamePlan.primaryContactTitle}` : ''}</div>
        ${gamePlan.meetingDate ? `<div class="meeting-date">${gamePlan.meetingDate}</div>` : ''}
      </div>

      <h1>Meeting Agenda</h1>

      <div class="section">
        <h2>Meeting Subject</h2>
        <p>${gamePlan.meetingSubject}</p>
      </div>

      <div class="section">
        <h2>Desired Outcome</h2>
        <div class="highlight">
          <p>${gamePlan.desiredOutcome}</p>
        </div>
      </div>

      <div class="section">
        <h2>Discussion Topics</h2>
        ${discussionPointsHtml}
      </div>

      <div class="footer">
        <p>Generated by SalesPilot AI • ${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;

  return await generatePDF(html, 'agenda', gamePlan.primaryCompanyName, templateName);
}

/**
 * Generate Presentation PDF
 */
export async function generatePresentationPDF(
  gamePlan: GamePlan,
  templateName: string = 'modern'
): Promise<PDFResult> {
  const template = templates[templateName] || templates.modern;

  // Parse markdown sections
  const companyAnalysisHtml = await parseMarkdown(gamePlan.companyAnalysis);
  const influenceTacticsHtml = await parseMarkdown(gamePlan.influenceTactics);
  const discussionPointsHtml = await parseMarkdown(gamePlan.discussionPoints);

  // Extract key sections from company analysis (first few paragraphs)
  const companyOverview = gamePlan.companyAnalysis.split('\n\n').slice(0, 3).join('\n\n');
  const companyOverviewHtml = await parseMarkdown(companyOverview);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${getCommonStyles(template)}
      <style>
        .slide {
          min-height: 90vh;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 40px;
        }

        .slide-title {
          text-align: center;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .slide-title h1 {
          font-size: 48px;
          margin-bottom: 2rem;
          border-bottom: none;
        }

        .slide-title .subtitle {
          font-size: 24px;
          color: ${template.colors.secondary};
          margin-bottom: 3rem;
        }

        .slide h2 {
          font-size: 32px;
          text-align: center;
          margin-bottom: 2rem;
        }

        .content-box {
          background: ${template.colors.accent}10;
          padding: 2rem;
          border-radius: 8px;
          border-left: 4px solid ${template.colors.accent};
        }
      </style>
    </head>
    <body>
      <!-- Slide 1: Title -->
      <div class="slide slide-title">
        <h1>${gamePlan.meetingSubject}</h1>
        <div class="subtitle">${gamePlan.primaryCompanyName}</div>
        ${gamePlan.meetingDate ? `<div class="meeting-date">${gamePlan.meetingDate}</div>` : ''}
      </div>

      <!-- Slide 2: Agenda -->
      <div class="slide">
        <h2>Agenda</h2>
        <div class="content-box">
          ${discussionPointsHtml}
        </div>
      </div>

      <!-- Slide 3: Company Overview -->
      <div class="slide">
        <h2>Company Overview</h2>
        ${companyOverviewHtml}
      </div>

      <!-- Slide 4: Key Challenges & Opportunities -->
      <div class="slide">
        <h2>Key Challenges & Opportunities</h2>
        ${companyAnalysisHtml}
      </div>

      <!-- Slide 5: Our Approach -->
      <div class="slide">
        <h2>Our Approach</h2>
        ${influenceTacticsHtml}
      </div>

      <!-- Slide 6: Discussion Points -->
      <div class="slide">
        <h2>Discussion Points</h2>
        ${discussionPointsHtml}
      </div>

      <!-- Slide 7: Next Steps -->
      <div class="slide">
        <h2>Next Steps</h2>
        <div class="content-box">
          <h3>Desired Outcome</h3>
          <p>${gamePlan.desiredOutcome}</p>
          <h3>Follow-up</h3>
          <ul>
            <li>Schedule follow-up meeting</li>
            <li>Send detailed proposal</li>
            <li>Address any outstanding questions</li>
          </ul>
        </div>
      </div>

      <!-- Slide 8: Thank You -->
      <div class="slide slide-title">
        <h1>Thank You</h1>
        <div class="subtitle">Looking forward to our partnership</div>
        <div class="footer">
          <p>Generated by SalesPilot AI • ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await generatePDF(html, 'presentation', gamePlan.primaryCompanyName, templateName);
}

/**
 * Core PDF generation function using Puppeteer
 */
async function generatePDF(
  html: string,
  type: string,
  companyName: string,
  templateName: string
): Promise<PDFResult> {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const safeCompanyName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${type}_${safeCompanyName}_${templateName}_${timestamp}.pdf`;

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  const filepath = path.join(uploadsDir, filename);

  let browser;
  try {
    // Launch Puppeteer with system Chromium (Alpine Linux)
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-gpu' // Applicable to headless mode
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    return {
      fileUrl: `/uploads/${filename}`,
      filename,
      filepath,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error(`Error generating ${type} PDF:`, error);
    throw new Error(`Failed to generate ${type} PDF: ${error.message}`);
  }
}

/**
 * Generate comprehensive game plan PDF with all analysis sections
 */
export async function generateGamePlanPDF(options: {
  gamePlan: any;
  sections?: string[];
}): Promise<Buffer> {
  const { gamePlan, sections = ['summary', 'companyAnalysis', 'contactPersona', 'influenceTactics', 'discussionPoints', 'objectionHandling'] } = options;

  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // Cover Page
      doc.fontSize(28).font('Helvetica-Bold').text('Sales Game Plan', { align: 'center' });
      doc.moveDown();
      doc.fontSize(20).text(gamePlan.primaryCompanyName || 'N/A', { align: 'center' });
      doc.moveDown(2);

      // Meeting Details
      doc.fontSize(14).font('Helvetica-Bold').text('Meeting Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Contact: ${gamePlan.primaryContactName || 'N/A'}`);
      doc.text(`Title: ${gamePlan.primaryContactTitle || 'N/A'}`);
      doc.text(`Subject: ${gamePlan.meetingSubject || 'N/A'}`);
      doc.text(`Desired Outcome: ${gamePlan.desiredOutcome || 'N/A'}`);
      doc.moveDown(2);

      // Company Analysis Section
      if (sections.includes('companyAnalysis') && gamePlan.companyAnalysis) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Company Analysis', { underline: true });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica').text(gamePlan.companyAnalysis, { align: 'left' });
        doc.moveDown();
      }

      // Contact Persona Section
      if (sections.includes('contactPersona') && gamePlan.contactPersona) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Contact Persona', { underline: true });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica').text(gamePlan.contactPersona, { align: 'left' });
        doc.moveDown();
      }

      // Influence Tactics Section
      if (sections.includes('influenceTactics') && gamePlan.influenceTactics) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Influence Tactics', { underline: true });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica').text(gamePlan.influenceTactics, { align: 'left' });
        doc.moveDown();
      }

      // Discussion Points Section
      if (sections.includes('discussionPoints') && gamePlan.discussionPoints) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Discussion Points', { underline: true });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica').text(gamePlan.discussionPoints, { align: 'left' });
        doc.moveDown();
      }

      // Objection Handling Section
      if (sections.includes('objectionHandling') && gamePlan.objectionHandling) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Objection Handling', { underline: true });
        doc.moveDown();
        doc.fontSize(11).font('Helvetica').text(gamePlan.objectionHandling, { align: 'left' });
        doc.moveDown();
      }

      // Footer on last page
      doc.fontSize(9).font('Helvetica').text(
        `Generated by SalesPilot AI on ${new Date().toLocaleDateString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
/**
 * Main service export
 */
export default {
  generateAgendaPDF,
  generatePresentationPDF,
  generateGamePlanPDF,
  templates
};
