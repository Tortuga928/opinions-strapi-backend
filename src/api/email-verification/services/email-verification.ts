import crypto from 'crypto';

/**
 * Email Verification Service
 * Handles email verification token generation, validation, and email sending
 */

interface VerificationTokenData {
  token: string;
  expires: Date;
}

interface VerificationEmailOptions {
  email: string;
  username: string;
  token: string;
  baseUrl: string;
}

interface PasswordResetEmailOptions {
  email: string;
  username: string;
  token: string;
  baseUrl: string;
}

export default {
  /**
   * Generate a unique verification token and expiration date
   * @returns Object with token and expiration date (24 hours from now)
   */
  generateVerificationToken(): VerificationTokenData {
    // Generate a secure random token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration to 24 hours from now
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    return { token, expires };
  },

  /**
   * Check if a verification token is valid (exists and not expired)
   * @param token - The token to validate
   * @param expires - The expiration date of the token
   * @returns Boolean indicating if token is valid
   */
  isTokenValid(token: string | null, expires: Date | null): boolean {
    if (!token || !expires) {
      return false;
    }

    const now = new Date();
    const expirationDate = new Date(expires);

    return now < expirationDate;
  },

  /**
   * Generate verification link URL
   * @param token - The verification token
   * @param baseUrl - The base URL of the frontend app (not used in this implementation)
   * @returns Complete verification URL pointing to backend endpoint
   */
  generateVerificationLink(token: string, baseUrl: string): string {
    // Link to backend API endpoint which will handle verification and redirect
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:1341';
    return `${backendUrl}/api/user-management/verify-email/${token}`;
  },

  /**
   * Send verification email via SendGrid
   * @param options - Email options (email, username, token, baseUrl)
   * @returns Promise that resolves when email is sent
   */
  async sendVerificationEmail(options: VerificationEmailOptions): Promise<void> {
    const { email, username, token, baseUrl } = options;

    // Generate verification link
    const verificationLink = this.generateVerificationLink(token, baseUrl);

    // Create email HTML content with clickable button
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Hi ${username},</p>
        <p>Thank you for updating your email address on the Opinion App. Please click the button below to verify your new email address:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}"
             style="background-color: #5a67d8; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2196f3;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #1565c0;">💡 Quick Tip:</p>
          <p style="margin: 0; color: #1976d2; font-size: 14px;">
            Make sure you're logged into the Opinion App before clicking the button above. The verification will happen in your current session.
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #5a67d8;">
          <p style="margin: 0 0 10px 0; font-weight: bold;">Can't click the button?</p>
          <p style="margin: 0 0 5px 0; font-size: 13px;">Copy and paste this link into your browser:</p>
          <p style="margin: 0; font-size: 12px; word-break: break-all; color: #5a67d8; font-family: monospace;">
            ${verificationLink}
          </p>
        </div>

        <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #856404; font-weight: bold;">⏰ This link expires in 24 hours</p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 13px;">
            For security, verification links are only valid for 24 hours. If your link expires, you can request a new one from your profile page.
          </p>
        </div>

        <p style="color: #666; font-size: 13px; margin-top: 30px;">
          If you didn't request this email verification, please ignore this email. Your email address will not be changed.
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 11px;">Opinion App Team</p>
      </div>
    `;

    // Create plain text version (fallback)
    const textContent = `
      Verify Your Email Address

      Hi ${username},

      Thank you for updating your email address on the Opinion App. Please visit this link to verify your new email address:

      ${verificationLink}

      Make sure you're logged into the Opinion App before clicking the link above.

      This link expires in 24 hours for security reasons.

      If you didn't request this email verification, please ignore this email.

      Opinion App Team
    `.trim();

    // Send email using Strapi's email plugin
    try {
      await strapi.plugins['email'].services.email.send({
        to: email,
        from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@opinions.app',
        subject: 'Verify Your Email Address - Opinion App',
        text: textContent,
        html: htmlContent,
      });

      strapi.log.info(`Verification email sent to ${email}`);
    } catch (error) {
      strapi.log.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  },

  /**
   * Send password reset email via SendGrid
   * @param options - Email options (email, username, token, baseUrl)
   * @returns Promise that resolves when email is sent
   */
  async sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
    const { email, username, token, baseUrl } = options;

    // Generate password reset link (points to backend endpoint)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:1341';
    const resetLink = `${backendUrl}/api/user-management/reset-password/${token}`;

    // Create email HTML content with clickable button
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${username},</p>
        <p>We received a request to reset your password for the Opinion App. Click the button below to create a new password:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #f56565; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2196f3;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #1565c0;">💡 How it works:</p>
          <p style="margin: 0; color: #1976d2; font-size: 14px;">
            Click the button above and you'll be taken directly to the password reset form. Enter your new password and you're done!
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f56565;">
          <p style="margin: 0 0 10px 0; font-weight: bold;">Can't click the button?</p>
          <p style="margin: 0 0 5px 0; font-size: 13px;">Copy and paste this link into your browser:</p>
          <p style="margin: 0; font-size: 12px; word-break: break-all; color: #f56565; font-family: monospace;">
            ${resetLink}
          </p>
        </div>

        <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #856404; font-weight: bold;">⏰ This link expires in 24 hours</p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 13px;">
            For security, password reset links are only valid for 24 hours. If your link expires, you can request a new one from the login page.
          </p>
        </div>

        <div style="background-color: #fee; border: 1px solid #fcc; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #c33; font-weight: bold;">🔒 Security Notice</p>
          <p style="margin: 5px 0 0 0; color: #c33; font-size: 13px;">
            If you didn't request this password reset, please ignore this email. Your password will not be changed. Someone may have entered your email address by mistake.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 11px;">Opinion App Team</p>
      </div>
    `;

    // Create plain text version (fallback)
    const textContent = `
      Reset Your Password

      Hi ${username},

      We received a request to reset your password for the Opinion App. Please visit this link to create a new password:

      ${resetLink}

      This link expires in 24 hours for security reasons.

      If you didn't request this password reset, please ignore this email. Your password will not be changed.

      Opinion App Team
    `.trim();

    // Send email using Strapi's email plugin
    try {
      await strapi.plugins['email'].services.email.send({
        to: email,
        from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@opinions.app',
        subject: 'Reset Your Password - Opinion App',
        text: textContent,
        html: htmlContent,
      });

      strapi.log.info(`Password reset email sent to ${email}`);
    } catch (error) {
      strapi.log.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  },
};
