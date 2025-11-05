# Payment Gateway API

PCI-DSS compliant payment gateway built with NestJS, implementing secure transaction processing with event-driven architecture using RabbitMQ, MongoDB, and advanced patterns like outbox/inbox for reliable messaging.

## Tech Stack

- **Framework**: NestJS 11
- **Runtime**: Node.js 20
- **Database**: MongoDB 7
- **Message Broker**: RabbitMQ 3

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


The backend system uses **JWT authentication** for both merchants and admins.
The **Auth Module** handles merchant authentication and is designed with extensibility in mind to support additional user types in the future.

However, **Admin authentication** is implemented separately within the **Admin Module** and is strictly for administrative use.

---

##  Authentication & Authorization

* **Merchants:**
  To initiate transactions, merchants must integrate with the **Payment Gateway** endpoints using **HMAC authentication**.
  Each merchant is assigned a pair of **API Key** and **API Secret**.
  The **API Secret** is displayed **only once** during creation and generation for security purposes.

* **JWT & HMAC Protected Endpoints:**
  Endpoints requiring JWT or HMAC are protected using **NestJS Guards**.

* **Admin Access:**
  Admin privileges are managed using **Role-Based Access Control (RBAC)**, also implemented via NestJS Guards.

---

##  Logging & Monitoring

* **Audit Logs:**
  All HTTP routes are monitored using a **NestJS Interceptor** for audit logging.
  Internal system operations are handled by a dedicated **Audit Service**.

  All API actions are logged with:
  - User ID and type (merchant/admin/system)
  - Action performed and resource accessed
  - Timestamp and IP address
  - **Sanitized** request details (CVV removed, cards masked), Logs are PCI-DSS compliant and never contain:
    - Full card numbers
    - CVV/CVC codes
    - Unencrypted PINs
    - Full authentication credentials

* **Rate Limiting:**
  Implemented using the **NestJS Throttler** package.

---

##  Scalability & Architecture

To ensure scalability, **transactions** are handled asynchronously.
Although transaction handling modules could be extracted into independent **microservices**, this project retains them within a single service for simplicity.

###  Transaction Handling Architecture

The architecture leverages the following design patterns:

* **Outbox / Inbox**
* **Circuit Breaker**
* **Unit of Work**
* **Queue-Based Load Leveling**

---

###  Transaction Flow

1. **HMAC Validation:**
   The transaction API call is authenticated using HMAC.

2. **Outbox Pattern:**
   A validated request triggers the Outbox pattern, and an **Outbox Relay Service** publishes an event to a **RabbitMQ** message queue.

3. **Consumer Processing:**
   The consumer checks the **Inbox** to verify if the message ID was already processed.
   If not, the **Acquiring Bank Consumer** processes the event through a mocked **Acquiring Bank Service** (since no real integration is required).
   Communication is treated as synchronous for this simulation.

4. **Bank Response Handling:**
   Upon receiving a response, another event is sent to a queue using the Outbox and Inbox patterns again.
   If the transaction is successful:

   * The transaction is marked as successful.
   * The merchant’s balance is updated using the **Unit of Work** pattern with **MongoDB transactions and sessions**.
   * A final event is queued for the **Webhook Service**, which sends updates to the merchant’s configured webhook URL.

5. **Load Leveling:**
   Additional consumers can be introduced to apply **queue-based load leveling**.

6. **Circuit Breaker:**
   If the acquiring bank service becomes unavailable, early failures are handled using the **Circuit Breaker pattern** to prevent latency spikes and system overload.

7. **Dead Letter Queue:**
   Failed messages are sent to **Dead Letter Queues** for manual inspection.

---

##  Message Queue

* **Broker:** RabbitMQ
* **Integration:** Directly via **amqplib**, without NestJS abstractions, to allow greater configurability.

---

## Card Data Security

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

## Merchant Withdrawals:
  Merchants can withdraw from their balance.
  Currently, this operation is handled internally without invoking the acquiring bank service.

---

##  Currency

All currencies are assumed to be in **USD**.
Currency conversion is **out of scope** for this project.

---

##  Testing

Unit tests are implemented for:

* Card tokenization
* Encryption
* HMAC validation

```bash
npm run test
```

---

##  API Documentation

* **Swagger UI:** Available at [`/api`](#)
Swagger UI includes a built-in HMAC Helper that automatically generates signatures for you:

* **Postman Collection:** Included in the repository

---

##  Deployment

* **Docker** and **Docker Compose** files are available for containerized deployment.

```bash
# Example usage
docker-compose up --build
```

---
**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`
- Email: `admin@paymentgateway.com`
- Role: `super_admin`

