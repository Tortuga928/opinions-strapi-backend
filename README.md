# Opinion App - Backend (Strapi)

A Strapi CMS backend for the Opinion Rating application, providing RESTful APIs for opinion management, user authentication, and rating systems.

## Features

- **Content Management**: Full CRUD operations for opinions and categories
- **User Authentication**: JWT-based authentication with registration/login
- **User Ratings**: Individual user rating system with isolation
- **Statistics API**: Aggregated statistics for opinions
- **Rate Limiting**: Built-in protection against API abuse
- **Database Support**: SQLite (dev) / PostgreSQL (production)
- **Security**: Input validation, CORS, and security headers

## Technology Stack

- **Framework**: Strapi 5.x
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT tokens
- **Language**: JavaScript/TypeScript
- **Runtime**: Node.js 16+

## Installation

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 12+ (for production)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd opinions-strapi-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start development server**
   ```bash
   npm run develop
   ```
   Admin panel: `http://localhost:1341/admin`
   API: `http://localhost:1341/api`

## Available Scripts

- **`npm run develop`** - Start with auto-reload (development)
- **`npm run start`** - Start without auto-reload (production)
- **`npm run build`** - Build admin panel
- **`npm run strapi`** - Run Strapi CLI commands

## API Structure

### Content Types

1. **Opinion**
   - `statement` (text): The opinion text
   - `category` (relation): Category reference
   - `isHidden` (boolean): Visibility flag

2. **Category**
   - `name` (string): Category name
   - `description` (text): Category description

3. **User Rating**
   - `rating` (integer): 0-10 scale
   - `comments` (text): User comments
   - `opinion` (relation): Opinion reference
   - `user` (relation): User reference

### API Endpoints

```
# Authentication
POST   /api/auth/local/register    # Register new user
POST   /api/auth/local             # Login user
GET    /api/users/me               # Get current user

# Content
GET    /api/opinions               # List opinions
POST   /api/opinions               # Create opinion
PUT    /api/opinions/:id           # Update opinion
DELETE /api/opinions/:id           # Delete opinion

GET    /api/categories             # List categories
GET    /api/categories/:id         # Get category

# Ratings
GET    /api/user-ratings           # Get user's ratings
POST   /api/user-ratings           # Create rating
PUT    /api/user-ratings/:id       # Update rating
GET    /api/user-ratings?stats=true&opinionId=X  # Get opinion statistics
```

## Production Deployment

### Environment Setup

1. **Create production environment file**
   ```bash
   cp .env.example .env.production
   ```

2. **Configure production variables**
   ```bash
   NODE_ENV=production
   DATABASE_CLIENT=postgres
   DATABASE_HOST=your-db-host
   DATABASE_PORT=5432
   DATABASE_NAME=opinions_production
   DATABASE_USERNAME=db_user
   DATABASE_PASSWORD=secure_password
   DATABASE_SSL=true

   # Generate secure keys
   APP_KEYS=key1,key2,key3,key4
   JWT_SECRET=your-jwt-secret
   ADMIN_JWT_SECRET=your-admin-secret
   API_TOKEN_SALT=your-api-salt
   TRANSFER_TOKEN_SALT=your-transfer-salt
   ```

3. **Generate secure keys**
   ```bash
   openssl rand -base64 32  # Run multiple times for different keys
   ```

### Database Migration

#### From SQLite to PostgreSQL

1. **Export data from SQLite**
   ```bash
   npm run strapi export -- --file backup.tar.gz
   ```

2. **Setup PostgreSQL database**
   ```sql
   CREATE DATABASE opinions_production;
   CREATE USER strapi_user WITH ENCRYPTED PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE opinions_production TO strapi_user;
   ```

3. **Update .env for PostgreSQL**
   ```bash
   DATABASE_CLIENT=postgres
   # ... other PostgreSQL settings
   ```

4. **Import data**
   ```bash
   npm run strapi import -- --file backup.tar.gz
   ```

### Deployment Options

#### Render.com

1. Create new Web Service
2. Connect GitHub repository
3. Set environment variables
4. Deploy with:
   - Build: `npm install && npm run build`
   - Start: `npm run start`

#### Heroku

```bash
# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set APP_KEYS="..."
# ... set other variables

# Deploy
git push heroku main
```

#### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 1337
CMD ["npm", "start"]
```

```bash
docker build -t opinion-backend .
docker run -p 1337:1337 --env-file .env.production opinion-backend
```

#### Traditional VPS

1. **Install dependencies**
   ```bash
   sudo apt update
   sudo apt install nodejs npm postgresql nginx
   ```

2. **Setup application**
   ```bash
   cd /var/www
   git clone <repository>
   cd opinions-strapi-backend
   npm install --production
   npm run build
   ```

3. **Configure PM2**
   ```bash
   npm install -g pm2
   pm2 start npm --name "strapi" -- start
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:1337;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Security Best Practices

1. **Environment Variables**
   - Never commit .env files
   - Use strong, unique secrets
   - Rotate keys regularly

2. **Database**
   - Use SSL connections
   - Regular backups
   - Limited user permissions

3. **API Security**
   - Enable rate limiting
   - Configure CORS properly
   - Use HTTPS in production
   - Implement request validation

4. **Monitoring**
   - Set up error tracking (Sentry)
   - Monitor server resources
   - Track API usage

## Backup and Recovery

### Automated Backups
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
npm run strapi export -- --file "backup_$DATE.tar.gz"
# Upload to S3 or other storage
```

### Manual Backup
```bash
npm run strapi export -- --file manual_backup.tar.gz
```

### Restore
```bash
npm run strapi import -- --file backup.tar.gz
```

## Performance Optimization

1. **Database Indexes**
   - Add indexes for frequently queried fields
   - Monitor slow queries

2. **Caching**
   - Implement Redis caching
   - Use CDN for static assets

3. **Query Optimization**
   - Use population sparingly
   - Implement pagination
   - Optimize N+1 queries

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   lsof -i :1337
   kill -9 <PID>
   ```

2. **Database Connection Failed**
   - Check credentials in .env
   - Verify database server is running
   - Check network connectivity

3. **Permission Errors**
   - Check file permissions
   - Verify database user permissions
   - Review Strapi role settings

## Development Notes

- Default port: 1341 (development)
- Admin credentials created on first run
- SQLite database stored in `.tmp/data.db`
- Uploads stored in `public/uploads`

## License

MIT License - see LICENSE file for details

## Support

- [Strapi Documentation](https://docs.strapi.io)
- [GitHub Issues](https://github.com/your-repo/issues)
- Review CLAUDE.md for development context