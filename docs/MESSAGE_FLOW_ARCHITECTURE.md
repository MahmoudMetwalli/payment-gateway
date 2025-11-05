# Message Flow Architecture

## Complete End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PRODUCER SIDE (Outbox Pattern)                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  Service Layer  │  (TransactionService, AuthService, etc.)
└────────┬────────┘
         │ 1. Business logic + DB write
         │ 2. Write to outbox table (same transaction)
         ▼
┌─────────────────┐
│  Outbox Table   │  { aggregateId, eventType, payload, status: PENDING }
└────────┬────────┘
         │ 3. Relay service polls every 5 seconds
         │    (@Cron('*/5 * * * * *'))
         ▼
┌─────────────────┐
│  Outbox Relay   │  processOutbox() → processEntryWithRetry()
│    Service      │  - Exponential backoff (1s, 2s, 4s)
└────────┬────────┘  - Circuit breaker protection
         │ 4. Publish to RabbitMQ
         │ 5. Mark as COMPLETED in outbox
         ▼
┌─────────────────┐
│    RabbitMQ     │  Exchange + Queue + DLX/DLQ
└────────┬────────┘
         │
         │
         ▼

┌──────────────────────────────────────────────────────────────────────────┐
│                         CONSUMER SIDE (Inbox Pattern)                     │
└──────────────────────────────────────────────────────────────────────────┘

         │ 6. Consume message directly
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            CONSUMER                                      │
│  (TransactionConsumer, BankResponseConsumer, WebhookConsumer)           │
│                                                                          │
│  consume() {                                                             │
│    const messageId = msg.properties.messageId || content.transactionId; │
│                                                                          │
│    // ✅ IDEMPOTENCY CHECK                                              │
│    if (await inboxService.isProcessed(messageId)) {                     │
│      this.logger.debug('Already processed, skipping...');               │
│      channel.ack(msg);                                                   │
│      return;                                                             │
│    }                                                                     │
│                                                                          │
│    // Process the message                                               │
│    await processMessage(content);                                       │
│                                                                          │
│    // ✅ MARK AS PROCESSED                                              │
│    await inboxService.markAsProcessed(messageId, eventType, content);   │
│                                                                          │
│    channel.ack(msg);                                                     │
│  }                                                                       │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ 7. Write to inbox table
                           ▼
                  ┌─────────────────┐
                  │  Inbox Table    │  { messageId, eventType, payload, status: PROCESSED }
                  └─────────────────┘
```

## Three Consumer Flows

### 1️⃣ Transaction Consumer Flow

```
┌──────────────────┐
│ Transaction      │  POST /transactions (merchant creates transaction)
│ Service          │  └─> writes to outbox: TRANSACTION_CREATED
└────────┬─────────┘
         │ Outbox relay publishes
         ▼
┌──────────────────┐
│ RabbitMQ         │  acquiring-bank.transaction.queue
└────────┬─────────┘
         │ Consumer receives
         ▼
┌──────────────────┐
│ Transaction      │  1. Check inbox.isProcessed(messageId)
│ Consumer         │  2. Send to acquiring bank simulation
└────────┬─────────┘  3. Create audit log
         │ 4. inbox.markAsProcessed()
         │ 5. ack message
         ▼
┌──────────────────┐
│ Inbox Table      │  Record: { messageId, eventType: 'TRANSACTION_CREATED', status: 'processed' }
└──────────────────┘
```

### 2️⃣ Bank Response Consumer Flow

```
┌──────────────────┐
│ Acquiring Bank   │  Simulated bank response after processing
│ Service          │  └─> publishes to queue directly (or via outbox)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ RabbitMQ         │  acquiring-bank.response.queue
└────────┬─────────┘
         │ Consumer receives
         ▼
┌──────────────────┐
│ Bank Response    │  1. Check inbox.isProcessed(messageId)
│ Consumer         │  2. Update transaction status
└────────┬─────────┘  3. Update merchant balance
         │ 4. Write to outbox: WEBHOOK_NOTIFICATION
         │ 5. Create audit log
         │ 6. inbox.markAsProcessed()
         │ 7. ack message
         ▼
┌──────────────────┐
│ Inbox Table      │  Record: { messageId, eventType: 'BANK_RESPONSE', status: 'processed' }
└────────┬─────────┘
         │ Outbox relay picks up webhook notification
         ▼
┌──────────────────┐
│ RabbitMQ         │  webhook.queue
└──────────────────┘
```

### 3️⃣ Webhook Consumer Flow

```
┌──────────────────┐
│ Outbox Relay     │  Publishes WEBHOOK_NOTIFICATION from outbox
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ RabbitMQ         │  webhook.queue
└────────┬─────────┘
         │ Consumer receives
         ▼
┌──────────────────┐
│ Webhook          │  1. Check inbox.isProcessed(messageId)
│ Consumer         │  2. HTTP POST to merchant webhook URL
└────────┬─────────┘  3. Create audit log
         │ 4. inbox.markAsProcessed()
         │ 5. ack message
         ▼
┌──────────────────┐
│ Inbox Table      │  Record: { messageId, eventType: 'WEBHOOK_NOTIFICATION', status: 'processed' }
└──────────────────┘
```

## Failure Handling

### Outbox Failures (Producer Side)

```
┌─────────────────┐
│ Outbox Entry    │  status: PENDING, retryCount: 0
└────────┬────────┘
         │ Relay tries to publish
         │ ❌ RabbitMQ connection fails
         ▼
┌─────────────────┐
│ Outbox Entry    │  status: FAILED, retryCount: 1, nextRetryAt: now + 1s
└────────┬────────┘
         │ Wait 1 second (exponential backoff)
         │ Retry scheduled task runs
         ▼
┌─────────────────┐
│ Outbox Entry    │  status: PENDING (reset by retryFailedEntries)
└────────┬────────┘
         │ Relay retries
         │ ❌ Still fails
         ▼
┌─────────────────┐
│ Outbox Entry    │  status: FAILED, retryCount: 2, nextRetryAt: now + 2s
└────────┬────────┘
         │ Continue until maxRetries (default: 3)
         │
         ▼
┌─────────────────┐
│ Outbox Entry    │  status: FAILED, retryCount: 3 (permanently failed)
└────────┬────────┘
         │ Admin can monitor via GET /admin/outbox/failed
         │ Admin can manually retry via POST /admin/outbox/failed/:id/reset
         ▼
```

### Consumer Failures (Consumer Side)

```
┌─────────────────┐
│ RabbitMQ        │  Message delivered to consumer
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Consumer        │  1. inbox.isProcessed() → false
└────────┬────────┘  2. processMessage() → ❌ throws error
         │ 3. catch block: channel.nack(msg, false, false)
         │ 4. inbox NOT marked as processed
         ▼
┌─────────────────┐
│ Dead Letter     │  Message sent to DLQ (no requeue)
│ Queue (DLQ)     │  Can be inspected and reprocessed later
└─────────────────┘
```

## Duplicate Message Handling

```
┌──────────────────────────────────────────────────────────────────┐
│                      SCENARIO: RabbitMQ Redelivery               │
└──────────────────────────────────────────────────────────────────┘

Time: T0
┌─────────────────┐
│ RabbitMQ        │  Delivers message (messageId: 'msg-123')
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Consumer A      │  1. inbox.isProcessed('msg-123') → false
└────────┬────────┘  2. Process message ✅
         │ 3. inbox.markAsProcessed('msg-123') ✅
         │ 4. Network issue before ack
         ▼
┌─────────────────┐
│ Inbox Table     │  { messageId: 'msg-123', status: 'processed' }
└─────────────────┘

Time: T1 (after redelivery timeout)
┌─────────────────┐
│ RabbitMQ        │  Redelivers same message (messageId: 'msg-123')
└────────┬────────┘  (because ack was not received)
         │
         ▼
┌─────────────────┐
│ Consumer B      │  1. inbox.isProcessed('msg-123') → ✅ TRUE
└────────┬────────┘  2. Skip processing (already done)
         │ 3. channel.ack(msg) immediately
         │ 4. No duplicate side effects! 🎉
         ▼
         (End - safe duplicate handling)
```

## Concurrency Handling

```
┌──────────────────────────────────────────────────────────────────┐
│              SCENARIO: Multiple Consumers, Same Message          │
└──────────────────────────────────────────────────────────────────┘

Time: T0 (identical message published to both consumers)
┌─────────────────┐                    ┌─────────────────┐
│ Consumer A      │                    │ Consumer B      │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ inbox.isProcessed('msg-123')         │ inbox.isProcessed('msg-123')
         │ → false (at same time)               │ → false (at same time)
         │                                      │
         │ processMessage() ✅                  │ processMessage() ✅
         │                                      │
         │ inbox.markAsProcessed()              │ inbox.markAsProcessed()
         │ └─> inbox.save()                     │ └─> inbox.save()
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MongoDB (Inbox Collection)               │
│  Unique constraint on: messageId                                │
│                                                                 │
│  Consumer A: INSERT { messageId: 'msg-123', ... }  ✅ Success   │
│  Consumer B: INSERT { messageId: 'msg-123', ... }  ❌ E11000    │
│              (Duplicate key error)                              │
└─────────────────────────────────────────────────────────────────┘
         │                                      │
         │ Success                              │ Catch E11000 error
         │                                      │ Log: "Already processed concurrently"
         │                                      │ Return (no error thrown)
         ▼                                      ▼
         Both ack message successfully
```

## Summary

| Component | Purpose | Persistence | Polling |
|-----------|---------|-------------|---------|
| **Outbox Table** | Ensure reliable message publishing | ✅ Yes | ✅ Yes (relay every 5s) |
| **Outbox Relay** | Poll outbox and publish to RabbitMQ | N/A | ✅ Scheduler |
| **RabbitMQ** | Message broker | ✅ Yes (persistent) | ❌ No (push to consumers) |
| **Inbox Table** | Ensure idempotent message processing | ✅ Yes | ❌ No (written inline) |
| **Consumers** | Process messages from RabbitMQ | N/A | ❌ No (event-driven) |

**Key Differences:**
- **Outbox**: Has dedicated relay service that polls database
- **Inbox**: No relay service - consumers write directly
- Both patterns ensure exactly-once semantics
- Both patterns use MongoDB for persistence
- Both patterns integrate with audit logging
