import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { circuitBreaker, ConsecutiveBreaker, handleAll, CircuitBreakerPolicy } from 'cockatiel';
import { OutboxService } from './outbox.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { OutboxEventType } from '../schemas/outbox.schema';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly breaker: CircuitBreakerPolicy;

  constructor(
    private outboxService: OutboxService,
    private rabbitMQService: RabbitMQService,
    private configService: ConfigService,
  ) {
    // Configure circuit breaker
    // Opens after 5 consecutive failures
    // Half-open state after 30 seconds
    this.breaker = circuitBreaker(handleAll, {
      halfOpenAfter: 30 * 1000,
      breaker: new ConsecutiveBreaker(5),
    });

    this.breaker.onBreak(() => {
      this.logger.error('Circuit breaker opened - RabbitMQ connection issues');
    });

    this.breaker.onReset(() => {
      this.logger.log('Circuit breaker reset - Connection restored');
    });

    this.breaker.onHalfOpen(() => {
      this.logger.warn('Circuit breaker half-open - Testing connection');
    });
  }

  /**
   * Poll and process outbox entries every 5 seconds
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutbox(): Promise<void> {
    try {
      const batchSize =
        this.configService.get<number>('OUTBOX_BATCH_SIZE') || 50;
      const entries = await this.outboxService.getPendingEntries(batchSize);

      if (entries.length === 0) {
        return;
      }

      this.logger.log(`Processing ${entries.length} outbox entries`);

      // Mark all as processing
      const ids = entries.map((e) => e._id.toString());
      await this.outboxService.markAsProcessing(ids);

      // Process each entry
      for (const entry of entries) {
        try {
          await this.processEntry(entry);
          await this.outboxService.markAsCompleted(entry._id.toString());
        } catch (error) {
          this.logger.error(
            `Failed to process outbox entry ${entry._id}:`,
            error,
          );
          await this.outboxService.markAsFailed(
            entry._id.toString(),
            error.message,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in outbox processing:', error);
    }
  }

  /**
   * Process a single outbox entry with circuit breaker protection
   */
  private async processEntry(entry: any): Promise<void> {
    const queue = this.getQueueForEventType(entry.eventType);

    // Use circuit breaker to protect RabbitMQ calls
    await this.breaker.execute(async () => {
      await this.rabbitMQService.publishToQueue(queue, entry.payload);
      this.logger.debug(
        `Published ${entry.eventType} to queue ${queue} for aggregate ${entry.aggregateId}`,
      );
    });
  }

  /**
   * Map event type to appropriate queue
   */
  private getQueueForEventType(eventType: OutboxEventType): string {
    switch (eventType) {
      case OutboxEventType.TRANSACTION_CREATED:
      case OutboxEventType.REFUND_REQUESTED:
      case OutboxEventType.CHARGEBACK_REQUESTED:
        return this.configService.get<string>('RABBITMQ_TRANSACTION_QUEUE') || 'transaction.queue';
      case OutboxEventType.WEBHOOK_NOTIFICATION:
        return this.configService.get<string>('RABBITMQ_WEBHOOK_QUEUE') || 'webhook.queue';
      default:
        return this.configService.get<string>('RABBITMQ_TRANSACTION_QUEUE') || 'transaction.queue';
    }
  }
}

