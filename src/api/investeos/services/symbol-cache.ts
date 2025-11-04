/**
 * Symbol Cache Service
 * Handles population and management of stock symbol cache for autocomplete
 */

interface SymbolData {
  ticker: string;
  companyName: string;
  exchange: string;
}

export default () => ({
  /**
   * Populate symbol cache from array of symbol data
   * @param symbols - Array of symbol objects
   * @returns Number of symbols processed
   */
  async populateCache(symbols: SymbolData[]): Promise<number> {
    const db = strapi.db;
    let processedCount = 0;

    for (const symbol of symbols) {
      try {
        // Check if symbol already exists
        const existing = await db.query('api::symbol-cache.symbol-cache').findOne({
          where: { ticker: symbol.ticker.toUpperCase() }
        });

        if (existing) {
          // Update existing entry
          await db.query('api::symbol-cache.symbol-cache').update({
            where: { id: existing.id },
            data: {
              companyName: symbol.companyName,
              exchange: symbol.exchange,
              lastUpdated: new Date()
            }
          });
        } else {
          // Create new entry
          await db.query('api::symbol-cache.symbol-cache').create({
            data: {
              ticker: symbol.ticker.toUpperCase(),
              companyName: symbol.companyName,
              exchange: symbol.exchange,
              lastUpdated: new Date(),
              publishedAt: new Date()
            }
          });
        }

        processedCount++;
      } catch (error) {
        strapi.log.error(`Failed to process symbol ${symbol.ticker}:`, error);
      }
    }

    return processedCount;
  },

  /**
   * Search symbols by ticker or company name
   * @param query - Search query string
   * @param limit - Maximum number of results (default 20)
   * @returns Array of matching symbols
   */
  async searchSymbols(query: string, limit: number = 20) {
    const db = strapi.db;

    const symbols = await db.query('api::symbol-cache.symbol-cache').findMany({
      where: {
        $or: [
          { ticker: { $containsi: query } },
          { companyName: { $containsi: query } }
        ]
      },
      limit,
      orderBy: { ticker: 'asc' }
    });

    return symbols;
  },

  /**
   * Get total count of cached symbols
   * @returns Total number of symbols in cache
   */
  async getSymbolCount(): Promise<number> {
    const db = strapi.db;

    const count = await db.query('api::symbol-cache.symbol-cache').count();
    return count;
  },

  /**
   * Clear all symbols from cache
   * @returns Number of symbols deleted
   */
  async clearCache(): Promise<number> {
    const db = strapi.db;

    const symbols = await db.query('api::symbol-cache.symbol-cache').findMany();

    for (const symbol of symbols) {
      await db.query('api::symbol-cache.symbol-cache').delete({
        where: { id: symbol.id }
      });
    }

    return symbols.length;
  },

  /**
   * Populate cache with common US stock symbols
   * This is a starter set of symbols for development/testing
   * In production, this should be replaced with a comprehensive symbol list
   */
  async populateCommonSymbols(): Promise<number> {
    const commonSymbols: SymbolData[] = [
      // Major Tech Stocks
      { ticker: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQ' },
      { ticker: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', companyName: 'Alphabet Inc. Class A', exchange: 'NASDAQ' },
      { ticker: 'GOOG', companyName: 'Alphabet Inc. Class C', exchange: 'NASDAQ' },
      { ticker: 'AMZN', companyName: 'Amazon.com Inc.', exchange: 'NASDAQ' },
      { ticker: 'META', companyName: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
      { ticker: 'TSLA', companyName: 'Tesla Inc.', exchange: 'NASDAQ' },
      { ticker: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQ' },
      { ticker: 'NFLX', companyName: 'Netflix Inc.', exchange: 'NASDAQ' },

      // Financial Services
      { ticker: 'JPM', companyName: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
      { ticker: 'BAC', companyName: 'Bank of America Corporation', exchange: 'NYSE' },
      { ticker: 'WFC', companyName: 'Wells Fargo & Company', exchange: 'NYSE' },
      { ticker: 'GS', companyName: 'Goldman Sachs Group Inc.', exchange: 'NYSE' },
      { ticker: 'MS', companyName: 'Morgan Stanley', exchange: 'NYSE' },
      { ticker: 'V', companyName: 'Visa Inc.', exchange: 'NYSE' },
      { ticker: 'MA', companyName: 'Mastercard Incorporated', exchange: 'NYSE' },

      // Healthcare
      { ticker: 'JNJ', companyName: 'Johnson & Johnson', exchange: 'NYSE' },
      { ticker: 'UNH', companyName: 'UnitedHealth Group Incorporated', exchange: 'NYSE' },
      { ticker: 'PFE', companyName: 'Pfizer Inc.', exchange: 'NYSE' },
      { ticker: 'ABBV', companyName: 'AbbVie Inc.', exchange: 'NYSE' },
      { ticker: 'TMO', companyName: 'Thermo Fisher Scientific Inc.', exchange: 'NYSE' },

      // Consumer & Retail
      { ticker: 'WMT', companyName: 'Walmart Inc.', exchange: 'NYSE' },
      { ticker: 'HD', companyName: 'Home Depot Inc.', exchange: 'NYSE' },
      { ticker: 'NKE', companyName: 'Nike Inc.', exchange: 'NYSE' },
      { ticker: 'MCD', companyName: 'McDonald\'s Corporation', exchange: 'NYSE' },
      { ticker: 'DIS', companyName: 'Walt Disney Company', exchange: 'NYSE' },
      { ticker: 'SBUX', companyName: 'Starbucks Corporation', exchange: 'NASDAQ' },

      // Industrial & Energy
      { ticker: 'BA', companyName: 'Boeing Company', exchange: 'NYSE' },
      { ticker: 'CAT', companyName: 'Caterpillar Inc.', exchange: 'NYSE' },
      { ticker: 'XOM', companyName: 'Exxon Mobil Corporation', exchange: 'NYSE' },
      { ticker: 'CVX', companyName: 'Chevron Corporation', exchange: 'NYSE' },

      // Telecom & Media
      { ticker: 'T', companyName: 'AT&T Inc.', exchange: 'NYSE' },
      { ticker: 'VZ', companyName: 'Verizon Communications Inc.', exchange: 'NYSE' },
      { ticker: 'CMCSA', companyName: 'Comcast Corporation', exchange: 'NASDAQ' },

      // Semiconductor & Tech Hardware
      { ticker: 'INTC', companyName: 'Intel Corporation', exchange: 'NASDAQ' },
      { ticker: 'AMD', companyName: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ' },
      { ticker: 'QCOM', companyName: 'QUALCOMM Incorporated', exchange: 'NASDAQ' },
      { ticker: 'CRM', companyName: 'Salesforce Inc.', exchange: 'NYSE' },
      { ticker: 'ORCL', companyName: 'Oracle Corporation', exchange: 'NYSE' },
      { ticker: 'IBM', companyName: 'International Business Machines Corporation', exchange: 'NYSE' },

      // ETFs (popular index funds)
      { ticker: 'SPY', companyName: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE' },
      { ticker: 'QQQ', companyName: 'Invesco QQQ Trust', exchange: 'NASDAQ' },
      { ticker: 'IWM', companyName: 'iShares Russell 2000 ETF', exchange: 'NYSE' },
      { ticker: 'DIA', companyName: 'SPDR Dow Jones Industrial Average ETF Trust', exchange: 'NYSE' },
      { ticker: 'VOO', companyName: 'Vanguard S&P 500 ETF', exchange: 'NYSE' }
    ];

    return this.populateCache(commonSymbols);
  },

  /**
   * Fetch symbols from Schwab API (future implementation)
   * This is a placeholder for when Schwab API symbol endpoint is integrated
   */
  async fetchFromSchwabAPI(userId: number): Promise<number> {
    // TODO: Implement Schwab API integration for comprehensive symbol list
    // For now, use populateCommonSymbols() as a fallback

    strapi.log.warn('Schwab API symbol fetch not yet implemented. Using common symbols list.');
    return this.populateCommonSymbols();
  }
});
