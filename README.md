# School App Backend

A comprehensive backend API for a school management system built with Node.js, Express, and Supabase.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Support for parents, teachers, admins, and principals
- **Academic Management**: Class divisions, student enrollment, and promotion system
- **Homework Management**: Create, assign, and track homework with file attachments
- **Messaging System**: Internal messaging with approval workflow
- **Leave Management**: Student leave request system
- **Calendar Events**: School calendar management
- **File Upload**: Support for homework attachments and documents

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT
- **File Upload**: Multer
- **Logging**: Winston
- **Validation**: Express-validator
- **Security**: Helmet, CORS

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project
- Git

## Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd school-app-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   cp env.template .env
   ```

   Edit `.env` file with your configuration:

   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=24h

   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=uploads/

   # Logging
   LOG_LEVEL=info
   ```

4. **Database Setup**
   - Run the SQL scripts in the root directory to set up your Supabase database
   - Start with `SUPABASE_SETUP_V2.sql` for the complete database schema

5. **Start the server**

   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Documentation

The API documentation is available in `API.md` with detailed endpoint descriptions, request/response formats, and examples.

### Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-heroku-app.herokuapp.com/api`

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic
├── utils/           # Utility functions
└── index.js         # Application entry point
```

## Deployment

### Heroku Deployment

1. **Install Heroku CLI**

   ```bash
   npm install -g heroku
   ```

2. **Login to Heroku**

   ```bash
   heroku login
   ```

3. **Create Heroku app**

   ```bash
   heroku create your-app-name
   ```

4. **Set environment variables**

   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set SUPABASE_URL=your_supabase_url
   heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
   heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set JWT_EXPIRES_IN=24h
   heroku config:set MAX_FILE_SIZE=10485760
   heroku config:set UPLOAD_PATH=uploads/
   heroku config:set LOG_LEVEL=info
   ```

5. **Deploy to Heroku**

   ```bash
   git push heroku main
   ```

6. **Open the app**
   ```bash
   heroku open
   ```

## Environment Variables

| Variable                    | Description                          | Required               |
| --------------------------- | ------------------------------------ | ---------------------- |
| `PORT`                      | Server port                          | No (default: 3000)     |
| `NODE_ENV`                  | Environment (development/production) | Yes                    |
| `SUPABASE_URL`              | Supabase project URL                 | Yes                    |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key               | Yes                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key            | Yes                    |
| `JWT_SECRET`                | JWT signing secret                   | Yes                    |
| `JWT_EXPIRES_IN`            | JWT expiration time                  | No (default: 24h)      |
| `MAX_FILE_SIZE`             | Maximum file upload size             | No (default: 10MB)     |
| `UPLOAD_PATH`               | File upload directory                | No (default: uploads/) |
| `LOG_LEVEL`                 | Logging level                        | No (default: info)     |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
