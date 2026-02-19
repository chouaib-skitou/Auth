# NestJS Authentication System

A production-ready, reusable authentication and authorization system built with NestJS. Features role-based access control (RBAC), email verification, JWT authentication, and comprehensive security measures.

## 🚀 Features

### Authentication
- **JWT Authentication** - Access tokens (15min) + Refresh tokens (7 days)
- **Email Verification** - Required before login with token-based verification
- **Password Reset** - Secure token-based password recovery (20min expiry)
- **Password Change** - Authenticated users can update their password
- **Email Verification Links** - Backend-handled verification with frontend redirects

### Authorization (RBAC)
- **5 Predefined Roles**: ADMIN, MANAGER, USER, ACCOUNTANT, SUPPORT
- **9 Granular Permissions**: CREATE_USERS, READ_USERS, UPDATE_USERS, DELETE_USERS, MANAGE_FINANCES, VIEW_REPORTS, MANAGE_TEAM, READ_OWN_DATA, UPDATE_OWN_DATA
- **Role Hierarchy**:
  - **ADMIN**: Full system access, can assign roles
  - **MANAGER**: Create/manage regular users, cannot modify other managers
  - **USER**: View/edit own profile only
  - **ACCOUNTANT**: Manage finances + view reports
  - **SUPPORT**: Read-only user access

### Security Features
- **Bcrypt Password Hashing** (10 rounds)
- **Email Verification Tokens** (1 hour expiry)
- **Password Reset Tokens** (20 minutes expiry)
- **JWT Guards** for protected routes
- **Role-Based Guards** for authorization
- **User Self-Access Control** - Users can only access their own data
- **Password Excluded** from all API responses

## 🛠️ Tech Stack

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: MySQL 8.0 with TypeORM
- **Authentication**: JWT (passport-jwt)
- **Email**: Nodemailer + MailHog (development)
- **Validation**: class-validator + class-transformer
- **API Documentation**: Swagger/OpenAPI
- **Containerization**: Docker + Docker Compose

## 📋 Prerequisites

- Node.js 18+ or Node.js 20+
- Docker & Docker Compose
- pnpm (recommended) or npm

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/chouaib-skitou/Auth
cd auth/api
pnpm install
```

### 2. Environment Setup

Create `api/.env`:

```env
# App Configuration
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=auth_user
DB_PASSWORD=auth_password
DB_DATABASE=auth_system
DB_SYNCHRONIZE=true
DB_LOGGING=true

# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-change-in-production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Token Expiration
EMAIL_VERIFICATION_TOKEN_EXPIRATION=1h
PASSWORD_RESET_TOKEN_EXPIRATION=20m

# Email Configuration (MailHog for development)
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=noreply@yourapp.com
MAIL_FROM_NAME=YourApp
```

> **Security Note**: Generate secure random secrets for production:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3. Start Services

```bash
# Start MySQL + MailHog
cd ../infra
docker compose up -d

# Seed roles & permissions
cd ../api
pnpm run seed

# Start API
pnpm run start:dev
```

### 4. Access Points

- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs
- **MailHog**: http://localhost:8025

## 📚 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | User login | ❌ |
| POST | `/auth/refresh` | Refresh access token | ❌ |
| POST | `/auth/verify-email` | Verify email with token | ❌ |
| GET | `/auth/verify-email/:token` | Verify via email link | ❌ |
| POST | `/auth/resend-verification` | Resend verification email | ❌ |
| POST | `/auth/forgot-password` | Request password reset | ❌ |
| POST | `/auth/reset-password` | Reset password with token | ❌ |
| GET | `/auth/reset-password/:token` | Reset via email link | ❌ |
| POST | `/auth/change-password` | Change own password | ✅ JWT |
| GET | `/auth/me` | Get current user profile | ✅ JWT |

### Users Management

| Method | Endpoint | Description | Required Roles |
|--------|----------|-------------|----------------|
| POST | `/users` | Create new user | ADMIN, MANAGER |
| GET | `/users` | List all users | ADMIN, MANAGER |
| GET | `/users/:id` | Get user by ID | ADMIN, MANAGER, USER (own only) |
| PATCH | `/users/:id` | Update user | ADMIN, MANAGER, USER (own only) |
| DELETE | `/users/:id` | Delete user | ADMIN, MANAGER |
| POST | `/users/:userId/roles/:roleName` | Assign role to user | ADMIN |

## 🔐 Access Control Rules

### User Creation
- ✅ **ADMIN** can create: ADMIN, MANAGER, USER, ACCOUNTANT, SUPPORT
- ✅ **MANAGER** can create: USER only (not other managers)
- ❌ **USER** cannot create users

### User Management
- ✅ **ADMIN** can update/delete anyone
- ✅ **MANAGER** can update/delete regular USERS only (not managers/admins)
- ✅ **USER** can update own username/email only (not password via PATCH)
- ❌ **MANAGER** cannot modify other MANAGERS or ADMINS
- ❌ Password updates only via `/auth/change-password` or `/auth/reset-password`

### Data Access
- ✅ **ADMIN/MANAGER** can view all users with roles & permissions
- ✅ **USER** can only view their own profile
- ❌ **USER** cannot view other users' information

## 🧪 Testing Workflow

### 1. Create Test User

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Verify Email

1. Open MailHog: http://localhost:8025
2. Click the verification link in the email
3. Backend verifies and redirects to frontend

### 3. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### 4. Access Protected Route

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5. Assign Role (Admin Only)

```bash
# First, login as admin and get role IDs from database
curl -X POST http://localhost:3000/users/USER_ID/roles/MANAGER \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

### 6. Test Role-Based Access

```bash
# As MANAGER - Get all users (should work)
curl http://localhost:3000/users \
  -H "Authorization: Bearer MANAGER_TOKEN"

# As USER - Get all users (should fail with 403)
curl http://localhost:3000/users \
  -H "Authorization: Bearer USER_TOKEN"

# As USER - Get own profile (should work)
curl http://localhost:3000/users/YOUR_USER_ID \
  -H "Authorization: Bearer USER_TOKEN"
```

## 📦 Database Schema

### Core Tables

**users**
- id (UUID, Primary Key)
- username (VARCHAR, Unique)
- email (VARCHAR, Unique)
- password (VARCHAR, Hashed)
- isEmailVerified (BOOLEAN)
- emailVerifiedAt (DATETIME, Nullable)
- createdAt (DATETIME)
- updatedAt (DATETIME)

**roles**
- id (UUID, Primary Key)
- name (VARCHAR, Unique) - ADMIN, MANAGER, USER, etc.
- description (TEXT)
- createdAt (DATETIME)
- updatedAt (DATETIME)

**permissions**
- id (UUID, Primary Key)
- name (VARCHAR, Unique) - CREATE_USERS, READ_USERS, etc.
- description (TEXT)
- createdAt (DATETIME)
- updatedAt (DATETIME)

**user_roles** (Many-to-Many)
- user_id (UUID, Foreign Key)
- role_id (UUID, Foreign Key)

**role_permissions** (Many-to-Many)
- role_id (UUID, Foreign Key)
- permission_id (UUID, Foreign Key)

### Token Tables

**refresh_tokens**
- id (UUID, Primary Key)
- token (TEXT)
- user_id (UUID, Foreign Key)
- expiresAt (DATETIME)
- isRevoked (BOOLEAN)
- createdAt (DATETIME)

**email_verification_tokens**
- id (UUID, Primary Key)
- token (TEXT)
- user_id (UUID, Foreign Key)
- expiresAt (DATETIME)
- isUsed (BOOLEAN)
- createdAt (DATETIME)

**password_reset_tokens**
- id (UUID, Primary Key)
- token (TEXT)
- user_id (UUID, Foreign Key)
- expiresAt (DATETIME)
- isUsed (BOOLEAN)
- createdAt (DATETIME)

## 🏗️ Project Structure

```
auth-system/
├── api/                          # NestJS Application
│   ├── src/
│   │   ├── auth/                 # Authentication module
│   │   │   ├── decorators/       # Custom decorators (@CurrentUser, @Roles)
│   │   │   ├── dto/              # Data transfer objects
│   │   │   ├── entities/         # Token entities
│   │   │   ├── guards/           # Auth guards (JWT, Roles)
│   │   │   ├── strategies/       # Passport strategies
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── users/                # Users module
│   │   │   ├── dto/              # User DTOs
│   │   │   ├── entities/         # User entity
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   ├── roles/                # Roles module
│   │   ├── permissions/          # Permissions module
│   │   ├── mail/                 # Email service
│   │   ├── config/               # Configuration files
│   │   │   ├── app.config.ts
│   │   │   ├── database.config.ts
│   │   │   ├── jwt.config.ts
│   │   │   └── mail.config.ts
│   │   ├── database/
│   │   │   └── seeders/          # Database seeders
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env
│   └── package.json
│
└── infra/                        # Infrastructure
    ├── docker-compose.yml        # MySQL + MailHog
    └── mysql/
        └── init.sql              # Database initialization

```

## 🔧 Available Scripts

```bash
# Development
pnpm run start:dev              # Start with hot-reload
pnpm run start:debug            # Start in debug mode

# Production
pnpm run build                  # Build for production
pnpm run start:prod             # Start production server

# Database
pnpm run seed                   # Seed roles & permissions

# Code Quality
pnpm run lint                   # Run ESLint
pnpm run lint --fix             # Fix lint errors
pnpm run format                 # Format code with Prettier

# Testing (to be implemented)
pnpm run test                   # Run unit tests
pnpm run test:e2e               # Run e2e tests
pnpm run test:cov               # Test coverage
```

## 🚢 Deployment Considerations

### Environment Variables
- Generate secure random secrets for JWT tokens
- Set `DB_SYNCHRONIZE=false` in production
- Use proper email SMTP server (not MailHog)
- Set appropriate `FRONTEND_URL` and `API_URL`

### Security Checklist
- [ ] Change all default passwords
- [ ] Generate secure JWT secrets
- [ ] Enable HTTPS in production
- [ ] Set up proper CORS configuration
- [ ] Use environment-specific configs
- [ ] Set up database backups
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Set up monitoring (e.g., Sentry)

### Production Email Setup
Replace MailHog with a real SMTP service (SendGrid, AWS SES, etc.):

```env
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASSWORD=your_sendgrid_api_key
MAIL_FROM=noreply@yourdomain.com
```

## 🔄 Integration Guide

This auth system is designed to be integrated into any NestJS project:

### 1. Copy Core Modules
```bash
cp -r api/src/auth your-project/src/
cp -r api/src/users your-project/src/
cp -r api/src/roles your-project/src/
cp -r api/src/permissions your-project/src/
cp -r api/src/mail your-project/src/
```

### 2. Update Imports
Update module imports in your `app.module.ts`

### 3. Run Seeder
Seed roles and permissions in your database

### 4. Customize
- Adjust roles and permissions to your needs
- Modify email templates
- Add additional user fields
- Extend authorization logic

## 📖 Documentation

- **Swagger API Docs**: Available at `/api/docs` when running
- **Postman Collection**: Import the collection from `/docs/postman`

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.