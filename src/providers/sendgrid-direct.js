module.exports = {
  init: (providerOptions = {}, settings = {}) => {
    return {
      send: async options => {
        const { to, from, subject, text, html } = options;

        // IMPORTANT: Force the from address to be the verified SendGrid sender
        // This ensures emails are sent from a verified sender identity
        // Do not remove or change this - it's required for SendGrid to work
        const fromEmail = 'steven.banke@gmail.com';

        // Check if this is a password reset email and modify the content
        let emailContent = html || text || '';

        // Extract the reset code from the text (it's the long string starting with ?code=)
        const codeMatch = emailContent.match(/\?code=([a-zA-Z0-9]+)/);
        if (codeMatch && subject && subject.toLowerCase().includes('password')) {
          const resetCode = codeMatch[1];
          // Create a properly formatted email with the code prominently displayed
          emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Reset Your Password</h2>
              <p>We received a request to reset your password for the Opinion App.</p>

              <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ Important: This is NOT a clickable link!</p>
                <p style="margin: 5px 0 0 0; color: #856404;">You need to copy the code below and paste it into the app.</p>
              </div>

              <p><strong>Your Password Reset Code:</strong></p>
              <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; border: 2px dashed #007AFF;">
                <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">📋 Copy this entire code:</p>
                <p style="margin: 0; font-size: 14px; font-weight: bold; color: #007AFF; word-break: break-all; font-family: monospace;">
                  ${resetCode}
                </p>
              </div>

              <p><strong>How to reset your password:</strong></p>
              <ol style="line-height: 1.8;">
                <li>Copy the code above (select all the text in the gray box)</li>
                <li>Go back to the Opinion App in your browser</li>
                <li>You should see a field asking for the "Reset Code"</li>
                <li>Paste the code into that field</li>
                <li>Enter your new password twice</li>
                <li>Click "Reset Password"</li>
              </ol>

              <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 10px; margin: 20px 0;">
                <p style="margin: 0; color: #1565C0; font-size: 13px;">
                  <strong>Tip:</strong> If you're not already on the reset screen, go to the login page and click "Forgot Password?" then enter your email again.
                </p>
              </div>

              <p style="color: #666; font-size: 12px; margin-top: 30px;">This code will expire in 30 minutes for security reasons. If you didn't request this password reset, please ignore this email.</p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              <p style="color: #999; font-size: 11px;">Opinion App Team</p>
            </div>
          `;
        }

        // Use fetch to call SendGrid API directly
        const msg = {
          personalizations: [{
            to: [{ email: typeof to === 'string' ? to : to.email }]
          }],
          from: {
            email: fromEmail,
            name: 'Opinion App'
          },
          reply_to: {
            email: fromEmail,
            name: 'Opinion App Support'
          },
          subject: subject || 'Password Reset Request',
          // IMPORTANT: SendGrid requires content in specific order
          // text/plain MUST come first, followed by text/html
          // Reversing this order will cause a 400 error
          content: [
            {
              type: 'text/plain',
              value: emailContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
            },
            {
              type: 'text/html',
              value: emailContent
            }
          ],
          categories: ['password-reset'],
          custom_args: {
            app: 'opinion-app',
            type: 'transactional'
          }
        };

        try {
          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${providerOptions.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(msg)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('SendGrid API Error:', errorText);
            throw new Error(`SendGrid API Error: ${response.status}`);
          }

          return { success: true };
        } catch (error) {
          console.error('Error sending email:', error.message);
          throw error;
        }
      },
    };
  },
};