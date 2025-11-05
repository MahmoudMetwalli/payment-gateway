import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  circuitBreaker,
  ConsecutiveBreaker,
  handleAll,
  CircuitBreakerPolicy,
} from 'cockatiel';
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

      // Process each entry with retry logic
      for (const entry of entries) {
        try {
          await this.processEntryWithRetry(entry);
          await this.outboxService.markAsCompleted(entry._id.toString());
          this.logger.debug(
            `Successfully processed outbox entry ${entry._id} (${entry.eventType})`,
          );
        } catch (error) {
          await this.handleFailedEntry(entry, error);
        }
      }
    } catch (error) {
      this.logger.error('Error in outbox processing:', error);
    }
  }

  /**
   * Process entry with exponential backoff retry
   */
  private async processEntryWithRetry(entry: any): Promise<void> {
    const maxRetries =
      this.configService.get<number>('OUTBOX_MAX_RETRIES') || 3;
    const baseDelay =
      this.configService.get<number>('OUTBOX_RETRY_DELAY_MS') || 1000;

    // Calculate delay with exponential backoff
    if (entry.retryCount > 0) {
      const delay = baseDelay * Math.pow(2, entry.retryCount - 1);
      this.logger.debug(
        `Retry attempt ${entry.retryCount}/${maxRetries} for entry ${entry._id}, waiting ${delay}ms`,
      );
      await this.sleep(delay);
    }

    await this.processEntry(entry);
  }

  /**
   * Handle failed outbox entry
   */
  private async handleFailedEntry(entry: any, error: any): Promise<void> {
    const maxRetries =
      this.configService.get<number>('OUTBOX_MAX_RETRIES') || 3;
    const newRetryCount = entry.retryCount + 1;

    this.logger.error(
      `Failed to process outbox entry ${entry._id} (attempt ${newRetryCount}/${maxRetries}):`,
      error.message,
    );

    if (newRetryCount >= maxRetries) {
      // Maximum retries reached - mark as permanently failed
      await this.outboxService.markAsFailed(
        entry._id.toString(),
        `Max retries (${maxRetries}) exceeded: ${error.message}`,
      );

      this.logger.error(
        `Outbox entry ${entry._id} permanently failed after ${maxRetries} attempts. Manual intervention required.`,
      );

      // TODO: Send alert to monitoring system
      // await this.alertService.sendCriticalAlert(...);
    } else {
      // Mark as failed but will be retried
      await this.outboxService.markAsFailed(
        entry._id.toString(),
        error.message,
      );

      this.logger.warn(
        `Outbox entry ${entry._id} will be retried (${newRetryCount}/${maxRetries})`,
      );
    }
  }

  /**
   * Retry failed entries (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedEntries(): Promise<void> {
    try {
      const maxRetries =
        this.configService.get<number>('OUTBOX_MAX_RETRIES') || 3;
      await this.outboxService.retryFailed(maxRetries);
      this.logger.debug('Reset failed outbox entries for retry');
    } catch (error) {
      this.logger.error('Error retrying failed entries:', error);
    }
  }

  /**
   * Clean up old completed entries (runs daily at midnight)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupCompletedEntries(): Promise<void> {
    try {
      const retentionDays =
        this.configService.get<number>('OUTBOX_RETENTION_DAYS') || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.outboxService.deleteCompletedBefore(cutoffDate);
      this.logger.log(
        `Cleaned up ${result.deletedCount} completed outbox entries older than ${retentionDays} days`,
      );
    } catch (error) {
      this.logger.error('Error cleaning up completed entries:', error);
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        return (
          this.configService.get<string>('RABBITMQ_TRANSACTION_QUEUE') ||
          'transaction.queue'
        );
      case OutboxEventType.WEBHOOK_NOTIFICATION:
        return (
          this.configService.get<string>('RABBITMQ_WEBHOOK_QUEUE') ||
          'webhook.queue'
        );
      default:
        return (
          this.configService.get<string>('RABBITMQ_TRANSACTION_QUEUE') ||
          'transaction.queue'
        );
    }
  }
}
