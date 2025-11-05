# Payment Gateway API - Postman Collection

Complete Postman collection for testing the PCI DSS compliant payment gateway API with comprehensive audit logging.

## 📦 Files

- `Payment-Gateway-API.postman_collection.json` - Complete API collection
- `Payment-Gateway-Local.postman_environment.json` - Local development environment

## 🚀 Quick Start

### 1. Import to Postman

1. Open Postman
2. Click **Import** button
3. Select both files:
   - `Payment-Gateway-API.postman_collection.json`
   - `Payment-Gateway-Local.postman_environment.json`
4. Select the **Payment Gateway - Local** environment in the top-right dropdown

### 2. Initial Setup

Before making requests, you need to:

1. **Start the application**:
   ```bash
   npm run start:dev
   ```

2. **Create a merchant account** (via seeding script or admin API)

3. **Update environment variables**:
   - Set `merchant_id` to your merchant ID
   - Or let the login request auto-populate it

### 3. Authentication Flow

1. **Login**: Use `Authentication > Merchant Login`
   - The JWT token is automatically saved to `{{jwt_token}}`
   - The refresh token is saved to `{{refresh_token}}`
   
2. All subsequent requests will use the JWT token automatically via Bearer auth

## 📚 Collection Structure

### 1. **Authentication**
- `POST /auth/login` - Login with credentials
- `POST /auth/refresh` - Refresh access token

### 2. **Tokenization** (PCI DSS Compliant)
- `POST /tokenization/tokenize` - Tokenize card data
- `POST /tokenization/detokenize` - Decrypt token (highly audited)
- `GET /tokenization/token/:id` - Get token info (safe metadata only)

### 3. **Transactions**
- `POST /transactions/purchase` - Create purchase (with card or token)
- `GET /transactions/:id` - Get transaction details
- `GET /transactions` - List transactions with filters

### 4. **Merchants**
- `GET /merchants/:id` - Get merchant profile
- `POST /merchants/:id/regenerate-credentials` - Regenerate API keys

### 5. **Audit Logs** (PCI DSS Compliance)
- `GET /audit/logs` - Query audit logs with filters
- `GET /audit/logs/:id` - Get specific audit log
- `GET /audit/cardholder-data-access` - PCI DSS 10.2.7
- `GET /audit/failed-authentications` - PCI DSS 10.2.4
- `GET /audit/critical-events` - Daily security review
- `GET /audit/user/:userId` - Complete user audit trail
- `GET /audit/transaction/:transactionId` - Transaction lifecycle
- `GET /audit/summary/daily` - Daily compliance report

### 6. **Health Check**
- `GET /health` - API health status

## 🔐 Security Features

### JWT Authentication
All protected endpoints require JWT Bearer token:
```
Authorization: Bearer {{jwt_token}}
```

### HMAC Signature (Alternative)
For server-to-server API calls, use HMAC signature:
```
X-Api-Key: {{api_key}}
X-Signature: <HMAC-SHA256 signature>
X-Timestamp: <Unix timestamp>
```

## 📊 Testing Scenarios

### Scenario 1: Complete Transaction Flow

1. **Login** → Get JWT token
2. **Tokenize Card** → Get token ID
3. **Create Purchase** → Submit transaction
4. **Check Transaction** → View status
5. **View Audit Trail** → See complete lifecycle

### Scenario 2: PCI DSS Compliance Check

1. **Daily Summary** → `GET /audit/summary/daily`
2. **Cardholder Data Access** → `GET /audit/cardholder-data-access`
3. **Failed Authentications** → `GET /audit/failed-authentications`
4. **Critical Events** → `GET /audit/critical-events`

### Scenario 3: Security Monitoring

1. **Attempt Failed Login** → Trigger audit log
2. **Check Failed Auth Logs** → `GET /audit/failed-authentications`
3. **Detokenize Card** → Highly sensitive operation
4. **Check Cardholder Data Access** → Verify it's logged

## 🧪 Test Data

### Test Card Numbers (Visa)
```
Valid: 4532015112830366
Valid: 4556737586899855
Valid: 4916738092593465
```

### Test Credentials
```json
{
  "userName": "merchant_user",
  "password": "SecurePassword123!"
}
```

## 📋 Environment Variables

The collection uses these environment variables (auto-populated by requests):

| Variable | Description | Auto-set by |
|----------|-------------|-------------|
| `base_url` | API base URL | Manual |
| `jwt_token` | JWT access token | Login request |
| `refresh_token` | JWT refresh token | Login request |
| `api_key` | API key for HMAC | Regenerate credentials |
| `api_secret` | API secret for HMAC | Regenerate credentials |
| `merchant_id` | Current merchant ID | Manual |
| `token_id` | Card token ID | Tokenize request |
| `transaction_id` | Transaction ID | Purchase request |

## 🔍 Audit Log Query Examples

### Get today's cardholder data access
```
GET /audit/cardholder-data-access?startDate=2025-11-05T00:00:00Z&endDate=2025-11-05T23:59:59Z
```

### Get failed logins in last hour
```
GET /audit/failed-authentications?startDate=2025-11-05T10:00:00Z
```

### Get specific merchant's activity
```
GET /audit/user/merchant123?startDate=2025-11-01&endDate=2025-11-30
```

### Get complete transaction audit trail
```
GET /audit/transaction/txn_abc123
```

### Daily compliance report
```
GET /audit/summary/daily?date=2025-11-05
```

## 📈 Expected Responses

### Successful Login Response
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

### Tokenization Response
```json
{
  "token": "tok_xxxxxxxxxxxxx",
  "cardLast4": "0366",
  "cardBrand": "visa",
  "expiryMonth": "12",
  "expiryYear": "2025"
}
```

### Transaction Response
```json
{
  "id": "673abc123def",
  "merchantId": "merchant123",
  "amount": 100.50,
  "currency": "USD",
  "status": "PENDING",
  "type": "PURCHASE",
  "cardLast4": "0366",
  "cardBrand": "visa",
  "createdAt": "2025-11-05T12:00:00Z"
}
```

### Daily Summary Response
```json
{
  "date": "2025-11-05",
  "totalEvents": 1543,
  "failedAuthentications": 12,
  "cardholderDataAccess": 234,
  "criticalEvents": 45,
  "transactionProcessing": 890,
  "systemAdministration": 23,
  "dataModifications": 156,
  "topUsers": [
    { "userId": "merchant123", "userName": "ACME Corp", "count": 456 }
  ],
  "topActions": [
    { "action": "TRANSACTION_CREATE", "count": 345 }
  ]
}
```

## 🛡️ PCI DSS Compliance

This collection includes all endpoints required for PCI DSS audit logging:

- ✅ **10.2.1** - User identification tracking
- ✅ **10.2.2** - Event type categorization
- ✅ **10.2.3** - Timestamp (automatic)
- ✅ **10.2.4** - Success/Failure logging
- ✅ **10.2.5** - Origination tracking
- ✅ **10.2.6** - Data access logging
- ✅ **10.2.7** - Cardholder data access (critical)
- ✅ **Daily Review** - Summary endpoint for compliance officers

## 🐛 Troubleshooting

### 401 Unauthorized
- Check if JWT token is set: `{{jwt_token}}`
- Token might be expired - use refresh endpoint
- Re-login if refresh fails

### 404 Not Found
- Verify the `base_url` is correct
- Check if the API is running
- Verify merchant/transaction IDs exist

### No audit logs returned
- Check date range filters
- Verify you have admin privileges
- Ensure audit logging is enabled

## 📝 Notes

1. **JWT Token Expiry**: Tokens expire after 15 minutes. Use the refresh endpoint to get a new token.

2. **Audit Log Access**: Most audit endpoints require admin privileges. Ensure your merchant account has admin role.

3. **Rate Limiting**: The API may implement rate limiting. Adjust request frequency if you get 429 errors.

4. **Test vs Production**: Always use test card numbers in development. Never use real card data.

5. **HMAC Authentication**: For server-to-server integration, implement HMAC signature generation as shown in `public/hmac-helper.js`.

## 🔗 Related Documentation

- [API Swagger Documentation](http://localhost:3000/api)
- [PCI DSS Requirements](https://www.pcisecuritystandards.org/)
- [NestJS Documentation](https://docs.nestjs.com/)

## 📞 Support

For issues or questions:
1. Check the API Swagger docs at `/api`
2. Review audit logs for error details
3. Check application logs for backend errors

---

**Version**: 1.0.0  
**Last Updated**: November 5, 2025  
**Maintained by**: Payment Gateway Team
