export default [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
      frameguard: {
        action: 'deny',  // X-Frame-Options: DENY (prevent clickjacking)
      },
      hsts: {
        maxAge: 31536000,  // 1 year in seconds
        includeSubDomains: true,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      permissionsPolicy: {
        geolocation: [],  // Block geolocation
        microphone: [],   // Block microphone
        camera: [],       // Block camera
      },
    },
  },
  'global::security-headers', // Custom security headers middleware (adds X-XSS-Protection, removes X-Powered-By)
  {
    name: 'strapi::cors',
    config: {
      origin: [
        // Development URLs
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:1338',
        'http://localhost:1339',
        // Production URLs
        'https://opinions.latest',           // Main frontend URL
        'https://www.nleos.com',             // Alternative domain
        'https://nleos.com',                 // Alternative domain (no www)
        'https://opinions-latest.onrender.com', // Render default URL
        // Environment variable (optional override)
        process.env.CLIENT_URL,
      ].filter(Boolean), // Remove undefined values
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'X-Requested-With',
      ],
      keepHeaderOnError: true,
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  'global::ai-auth', // AI Manager authentication (must run before rate limit)
  'global::ai-rate-limit', // AI Manager rate limiting
];
