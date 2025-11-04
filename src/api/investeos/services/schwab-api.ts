/**
 * Schwab API Service
 * Handles OAuth 2.0 authentication and API interactions with Charles Schwab/thinkorswim API
 */

import axios from 'axios';
import crypto from 'crypto';

// Schwab API Configuration
const SCHWAB_AUTH_URL = process.env.SCHWAB_AUTH_URL || 'https://api.schwabapi.com/v1/oauth';
const SCHWAB_TOKEN_URL = process.env.SCHWAB_TOKEN_URL || 'https://api.schwabapi.com/v1/oauth/token';
const SCHWAB_API_BASE_URL = process.env.SCHWAB_API_BASE_URL || 'https://api.schwabapi.com/v1';
const SCHWAB_CLIENT_ID = process.env.SCHWAB_CLIENT_ID;
const SCHWAB_CLIENT_SECRET = process.env.SCHWAB_CLIENT_SECRET;
const SCHWAB_REDIRECT_URI = process.env.SCHWAB_REDIRECT_URI || 'http://localhost:3003/investeos-oauth-callback';

interface SchwabTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface OAuthState {
  userId: number;
  timestamp: number;
  nonce: string;
}

export default {
  /**
   * Generate OAuth authorization URL
   * Step 1 of OAuth flow
   */
  async generateAuthUrl(userId: number): Promise<{ authUrl: string; state: string }> {
    try {
      // Validate required environment variables
      if (!SCHWAB_CLIENT_ID) {
        throw new Error('SCHWAB_CLIENT_ID not configured');
      }

      // Generate secure state parameter
      const stateData: OAuthState = {
        userId,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      };

      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

      // Build authorization URL
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: SCHWAB_CLIENT_ID,
        redirect_uri: SCHWAB_REDIRECT_URI,
        scope: 'read offline_access', // Adjust scopes as needed
        state
      });

      const authUrl = `${SCHWAB_AUTH_URL}/authorize?${params.toString()}`;

      strapi.log.info(`[Schwab OAuth] Generated auth URL for user ${userId}`);

      return { authUrl, state };
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Error generating auth URL:', error);
      throw error;
    }
  },

  /**
   * Exchange authorization code for access tokens
   * Step 2 of OAuth flow
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<{ tokens: SchwabTokens; userId: number }> {
    try {
      // Validate required environment variables
      if (!SCHWAB_CLIENT_ID || !SCHWAB_CLIENT_SECRET) {
        throw new Error('Schwab API credentials not configured');
      }

      // Decode and validate state
      const stateData: OAuthState = JSON.parse(Buffer.from(state, 'base64').toString());

      // Verify state isn't too old (15 minutes max)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 15 * 60 * 1000) {
        throw new Error('OAuth state expired');
      }

      // Exchange code for tokens
      const response = await axios.post(
        SCHWAB_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: SCHWAB_REDIRECT_URI,
          client_id: SCHWAB_CLIENT_ID,
          client_secret: SCHWAB_CLIENT_SECRET
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokens: SchwabTokens = response.data;

      strapi.log.info(`[Schwab OAuth] Tokens obtained for user ${stateData.userId}`);

      return { tokens, userId: stateData.userId };
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<SchwabTokens> {
    try {
      if (!SCHWAB_CLIENT_ID || !SCHWAB_CLIENT_SECRET) {
        throw new Error('Schwab API credentials not configured');
      }

      const response = await axios.post(
        SCHWAB_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: SCHWAB_CLIENT_ID,
          client_secret: SCHWAB_CLIENT_SECRET
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokens: SchwabTokens = response.data;

      strapi.log.info('[Schwab OAuth] Access token refreshed');

      return tokens;
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  },

  /**
   * Store OAuth tokens for user
   */
  async storeTokens(userId: number, tokens: SchwabTokens, accountId?: string): Promise<void> {
    try {
      const expiryDate = new Date(Date.now() + tokens.expires_in * 1000);

      // Check if config already exists for user
      const existingConfigs = await strapi.db.query('api::investeos-config.investeos-config').findMany({
        where: {
          user: userId
        }
      });

      if (existingConfigs.length > 0) {
        // Update existing config
        await strapi.db.query('api::investeos-config.investeos-config').update({
          where: { id: existingConfigs[0].id },
          data: {
            schwabAccessToken: tokens.access_token,
            schwabRefreshToken: tokens.refresh_token,
            tokenExpiry: expiryDate,
            schwabAccountId: accountId || existingConfigs[0].schwabAccountId,
            isConnected: true
          }
        });
      } else {
        // Create new config
        await strapi.db.query('api::investeos-config.investeos-config').create({
          data: {
            user: userId,
            schwabAccessToken: tokens.access_token,
            schwabRefreshToken: tokens.refresh_token,
            tokenExpiry: expiryDate,
            schwabAccountId: accountId,
            isConnected: true
          }
        });
      }

      strapi.log.info(`[Schwab OAuth] Tokens stored for user ${userId}`);
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Error storing tokens:', error);
      throw error;
    }
  },

  /**
   * Get valid access token for user (refresh if expired)
   */
  async getValidAccessToken(userId: number): Promise<string | null> {
    try {
      const configs = await strapi.db.query('api::investeos-config.investeos-config').findMany({
        where: {
          user: userId,
          isConnected: true
        }
      });

      if (configs.length === 0) {
        return null;
      }

      const config = configs[0];
      const now = new Date();
      const expiryDate = new Date(config.tokenExpiry);

      // If token expires in less than 5 minutes, refresh it
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiryDate <= fiveMinutesFromNow) {
        strapi.log.info(`[Schwab OAuth] Token expired or expiring soon, refreshing for user ${userId}`);

        // Refresh token
        const newTokens = await this.refreshAccessToken(config.schwabRefreshToken);
        await this.storeTokens(userId, newTokens, config.schwabAccountId);

        return newTokens.access_token;
      }

      return config.schwabAccessToken;
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Error getting valid token:', error);
      throw error;
    }
  },

  /**
   * Disconnect Schwab account
   */
  async disconnectAccount(userId: number): Promise<void> {
    try {
      await strapi.db.query('api::investeos-config.investeos-config').updateMany({
        where: {
          user: userId
        },
        data: {
          schwabAccessToken: null,
          schwabRefreshToken: null,
          tokenExpiry: null,
          isConnected: false
        }
      });

      strapi.log.info(`[Schwab OAuth] Account disconnected for user ${userId}`);
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Error disconnecting account:', error);
      throw error;
    }
  },

  /**
   * Get connection status for user
   */
  async getConnectionStatus(userId: number): Promise<{ isConnected: boolean; accountId?: string }> {
    try {
      const configs = await strapi.db.query('api::investeos-config.investeos-config').findMany({
        where: {
          user: userId
        }
      });

      if (configs.length === 0 || !configs[0].isConnected) {
        return { isConnected: false };
      }

      return {
        isConnected: true,
        accountId: configs[0].schwabAccountId
      };
    } catch (error) {
      strapi.log.error('[Schwab OAuth] Error getting connection status:', error);
      return { isConnected: false };
    }
  },

  /**
   * Make authenticated API request to Schwab
   */
  async makeAuthenticatedRequest(userId: number, endpoint: string, options: any = {}): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      if (!accessToken) {
        throw new Error('User not connected to Schwab');
      }

      const response = await axios({
        ...options,
        url: `${SCHWAB_API_BASE_URL}${endpoint}`,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      strapi.log.error('[Schwab API] Request error:', error.response?.data || error.message);
      throw error;
    }
  }
};
