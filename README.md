# Payment Gateway API

A production-ready, PCI-DSS compliant payment gateway built with NestJS, implementing secure transaction processing with event-driven architecture using RabbitMQ, MongoDB, and advanced patterns like outbox/inbox for reliable messaging.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Security & PCI-DSS Compliance](#security--pci-dss-compliance)
- [Testing](#testing)
- [Deployment](#deployment)

## Features

### Core Functionality
- **Merchant Management**: Complete CRUD operations with JWT-based authentication
- **Transaction Processing**: 
  - Synchronous purchase transactions
  - Asynchronous refunds and chargebacks
  - Real-time status tracking
- **Card Tokenization**: Secure card data storage with format-preserving tokens
- **HMAC Authentication**: Request signing for transaction endpoints
- **Webhook Notifications**: Automatic merchant notifications with retry logic
- **Admin Dashboard**: Separate admin portal with role-based access

### Technical Features
- **Outbox Pattern**: Ensures reliable message delivery with Unity of Work
- **Inbox Pattern**: Guarantees idempotent message processing
- **Circuit Breaker**: Resilient connections with automatic failure handling (using Cockatiel)
- **Audit Logging**: PCI-DSS compliant logging with automatic data sanitization
- **Event-Driven Architecture**: Async processing with RabbitMQ
- **Banking Integration**: Merchant withdrawals with encrypted banking information

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HMAC Auth
       ▼
┌─────────────┐
│ Transaction │──────────┐
│  Endpoint   │          │
└─────────────┘          │
       │                 │ Unity of Work
       ▼                 ▼
┌─────────────┐    ┌─────────────┐
│Transaction  │    │   Outbox    │
│   Record    │    │   Entry     │
└─────────────┘    └──────┬──────┘
                          │
                          │ Relay Service (Cron)
                          ▼
                   ┌─────────────┐
                   │  RabbitMQ   │
                   │    Queue    │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Acquiring  │
                   │    Bank     │◄── Circuit Breaker
                   │   (Mock)    │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Response   │
                   │    Queue    │
                   └──────┬──────┘
                          │
                 ┌────────┴────────┐
                 │                 │
                 ▼                 ▼
         ┌─────────────┐   ┌─────────────┐
         │   Update    │   │  Webhook    │
         │   Balance   │   │    Queue    │
         └─────────────┘   └──────┬──────┘
                                  │
                                  ▼
                           ┌─────────────┐
                           │  Merchant   │
                           │  Webhook    │
                           └─────────────┘
```

### Key Patterns

#### 1. Outbox Pattern
Ensures atomicity between database writes and message publishing:
- Transaction and outbox entry created in same database transaction
- Relay service polls outbox and publishes to RabbitMQ
- Prevents message loss even if RabbitMQ is temporarily unavailable

#### 2. Inbox Pattern
Guarantees idempotent message processing:
- Each message has unique ID
- Inbox stores processed message IDs
- Duplicate messages are ignored

#### 3. Circuit Breaker
Protects system from cascading failures:
- Opens after 5 consecutive failures
- Half-open state after 30 seconds
- Automatic recovery when service is healthy

## Tech Stack

- **Framework**: NestJS 11
- **Runtime**: Node.js 20
- **Database**: MongoDB 7
- **Message Broker**: RabbitMQ 3
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Encryption**: AES-256-GCM
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 20 or higher
- MongoDB 7 or higher
- RabbitMQ 3 or higher
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd payment-gateway
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start dependencies (using Docker)**
```bash
docker-compose up mongodb rabbitmq -d
```

5. **Run the application**
```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

Access the application:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Application
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/payment-gateway

# JWT
# Application
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/payment-gateway

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Admin JWT
ADMIN_JWT_SECRET=your-admin-jwt-secret-change-this-in-production

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-change-this-must-be-32-bytes!!
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_IV_LENGTH=16

# HMAC
HMAC_TIMESTAMP_TOLERANCE=300

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_TRANSACTION_QUEUE=transaction.queue
RABBITMQ_BANK_RESPONSE_QUEUE=acquiring-bank.response.queue
RABBITMQ_WEBHOOK_QUEUE=webhook.queue

# Outbox Relay
OUTBOX_POLL_INTERVAL=5000
OUTBOX_BATCH_SIZE=50

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Webhook
WEBHOOK_MAX_RETRIES=3
WEBHOOK_TIMEOUT_MS=10000

# Default Admin (for initial seeding)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_EMAIL=admin@paymentgateway.com
DEFAULT_ADMIN_ROLE=super_admin
```

## Default Admin Account

On first startup, a seed script automatically creates a default admin account if no admins exist. This allows you to log in and create additional admin accounts.

The seed script runs as part of the Docker Compose setup and executes before the application starts.

**Default Credentials:**
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@paymentgateway.com`
- **Role**: `super_admin`

⚠️ **Important**: Change the default password immediately after first login for security!

You can customize these defaults by setting the following environment variables:
- `DEFAULT_ADMIN_USERNAME` (default: `admin`)
- `DEFAULT_ADMIN_PASSWORD` (default: `admin123`)
- `DEFAULT_ADMIN_EMAIL` (default: `admin@paymentgateway.com`)
- `DEFAULT_ADMIN_ROLE` (default: `super_admin`)

**Login:**
```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## API Documentation

### Swagger UI

Access interactive API documentation at: http://localhost:3000/api

### Main Endpoints

#### Merchant Authentication
```http
POST /auth/merchant/login
Content-Type: application/json

{
  "userName": "merchant1",
  "password": "password123"
}
```

#### Admin Authentication
```http
POST /admin/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

> **Note**: The default admin account is automatically created on first startup. See [Default Admin Account](#default-admin-account) section for details.

#### Create Transaction (HMAC Auth)
```http
POST /transactions/purchase
X-API-Key: pk_xxx
X-Signature: <HMAC-SHA256 signature>
X-Timestamp: <Unix timestamp>
Content-Type: application/json

{
  "amount": 1000,
  "currency": "USD",
  "cardData": {
    "cardNumber": "4532015112830366",
    "cvv": "123",
    "expiryMonth": 12,
    "expiryYear": 2025,
    "cardHolderName": "John Doe"
  }
}
```

#### List Transactions
```http
GET /transactions
X-API-Key: pk_xxx
X-Signature: <HMAC signature>
X-Timestamp: <Unix timestamp>
```

## Authentication

### Merchant JWT Authentication

Used for merchant portal access:

1. Login to get tokens:
```bash
curl -X POST http://localhost:3000/auth/merchant/login \
  -H "Content-Type: application/json" \
  -d '{"userName":"merchant1","password":"password123"}'
```

2. Use access token in subsequent requests:
```bash
curl -X GET http://localhost:3000/merchants/profile \
  -H "Authorization: Bearer <access_token>"
```

### HMAC Authentication

Used for transaction endpoints to ensure request integrity.

#### Testing HMAC in Swagger UI

**Easy Testing with HMAC Helper:**

Swagger UI includes a built-in HMAC Helper that automatically generates signatures for you:

1. Open Swagger UI at http://localhost:3000/api
2. Look for the **"🔐 HMAC Helper"** panel in the top-right corner
3. Enter your **API Key** and **API Secret**
4. Click **"Save Credentials"**
5. Try any transaction endpoint - HMAC headers are automatically generated!

The helper:
- ✅ Automatically generates timestamps
- ✅ Calculates HMAC-SHA256 signatures
- ✅ Injects headers before sending requests
- ✅ Saves credentials in browser localStorage (for convenience)

#### Generating HMAC Signature (Manual)

For programmatic access, generate HMAC signatures manually:

```javascript
const crypto = require('crypto');

// Your request
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = { amount: 1000, currency: 'USD', ... };

// Create payload
const payload = `${timestamp}.${JSON.stringify(body)}`;

// Generate signature
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(payload)
  .digest('hex');

// Add headers to request
headers['X-API-Key'] = apiKey;
headers['X-Signature'] = signature;
headers['X-Timestamp'] = timestamp;
```

### Admin Authentication

Separate JWT authentication for admin users. The default admin account is automatically created on first startup:

```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`
- Email: `admin@paymentgateway.com`
- Role: `super_admin`

⚠️ **Change the default password after first login!**

## Security & PCI-DSS Compliance

### Card Data Security

1. **Tokenization**: Raw card data is never stored
   - Card numbers are tokenized immediately upon receipt
   - Tokens are used for all subsequent operations
   - Original card data is encrypted using AES-256-GCM

2. **Encryption**: Sensitive data encrypted at rest
   - Banking information encrypted with AES-256-GCM
   - Separate encryption keys for different data types
   - Initialization vectors (IV) and authentication tags

3. **Masking**: Display only last 4 digits
   - Card numbers: ************1234
   - Account numbers: ********5678

### Audit Logging

All API actions are logged with:
- User ID and type (merchant/admin/system)
- Action performed and resource accessed
- Timestamp and IP address
- **Sanitized** request details (CVV removed, cards masked)

Logs are PCI-DSS compliant and never contain:
- Full card numbers
- CVV/CVC codes
- Unencrypted PINs
- Full authentication credentials

### HMAC Request Signing

Prevents:
- Man-in-the-middle attacks
- Request tampering
- Replay attacks (timestamp validation)

### Additional Security Measures

- **Rate Limiting**: Configurable per endpoint
- **Input Validation**: class-validator on all DTOs
- **SQL Injection Protection**: MongoDB with parameterized queries
- **XSS Protection**: Built-in NestJS sanitization
- **CORS**: Configurable origins
- **Helmet**: Security headers
- **HTTPS Only**: Production requirement

## Testing

### Unit Tests

Run unit tests for critical services:

```bash
npm run test
```

Test coverage:
```bash
npm run test:cov
```

### E2E Tests

```bash
npm run test:e2e
```

### Manual Testing with Postman

Import the Postman collection (can be generated from Swagger):

1. Visit http://localhost:3000/api
2. Click "Export" → "Postman Collection"
3. Import into Postman

## Deployment

### Production Checklist

- [ ] Change all default secrets in `.env`
- [ ] Use strong ENCRYPTION_KEY (exactly 32 characters)
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up MongoDB replica set
- [ ] Configure RabbitMQ cluster
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Review and harden security settings
- [ ] Perform security audit
- [ ] Load testing

### Docker Deployment

```bash
# Build production image
docker build -t payment-gateway:latest .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Scale app instances
docker-compose up -d --scale app=3
```

### Environment-Specific Configurations

Create separate `.env.production`, `.env.staging` files:

```bash
docker-compose --env-file .env.production up -d
```

## Project Structure

```
src/
├── acquiring-bank/      # Mock acquiring bank service
├── admin/              # Admin portal
├── audit/              # PCI-DSS audit logging
├── auth/               # Authentication & JWT
├── common/             # Shared modules
│   ├── database/       # Unity of Work
│   ├── hmac/          # HMAC authentication
│   ├── inbox/         # Inbox pattern
│   ├── outbox/        # Outbox pattern
│   └── rabbitmq/      # RabbitMQ service
├── merchants/          # Merchant management
├── tokenization/       # Card tokenization
├── transactions/       # Transaction processing
└── webhooks/          # Webhook delivery
```
