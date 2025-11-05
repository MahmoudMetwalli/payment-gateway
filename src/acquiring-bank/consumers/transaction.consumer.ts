import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import {
  DLXSetupService,
  DLQRoutingKey,
} from 'src/common/rabbitmq/dlx-setup.service';
import { InboxService } from 'src/common/inbox/services/inbox.service';
import { AcquiringBankService } from '../services/acquiring-bank.service';
import {
  Transaction,
  TransactionStatus,
} from 'src/transactions/schemas/transaction.schema';
import { OutboxEventType } from 'src/common/outbox/schemas/outbox.schema';

@Injectable()
export class TransactionConsumer implements OnModuleInit {
  private readonly logger = new Logger(TransactionConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private dlxSetup: DLXSetupService,
    private inboxService: InboxService,
    private acquiringBankService: AcquiringBankService,
    private configService: ConfigService,
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
  ) {}

  async onModuleInit() {
    const queueName =
      this.configService.get<string>('RABBITMQ_TRANSACTION_QUEUE') ||
      'transaction.queue';
    this.startConsuming(queueName);
  }

  private async startConsuming(queueName: string): Promise<void> {
    const channelWrapper = this.rabbitMQService.getChannelWrapper();

    await channelWrapper.addSetup(async (channel) => {
      // DLX already setup by RabbitMQService
      // Just assert queue with DLX options
      await channel.assertQueue(
        queueName,
        this.dlxSetup.getQueueOptions(DLQRoutingKey.TRANSACTION),
      );

      await channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const content = JSON.parse(msg.content.toString());
            const messageId = msg.properties.messageId || content.transactionId;

            // Check idempotency using inbox
            if (await this.inboxService.isProcessed(messageId)) {
              this.logger.debug(`Message ${messageId} already processed`);
              channel.ack(msg);
              return;
            }

            await this.processMessage(content, messageId);
            await this.inboxService.markAsProcessed(
              messageId,
              content.eventType || OutboxEventType.TRANSACTION_CREATED,
              content,
            );

            channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing message:', error);
            // Reject without requeue - goes to DLQ
            channel.nack(msg, false, false);
          }
        },
        { noAck: false },
      );
    });

    this.logger.log(`Started consuming from queue: ${queueName}`);
  }

  private async processMessage(content: any, messageId: string): Promise<void> {
    const eventType = content.eventType || OutboxEventType.TRANSACTION_CREATED;

    switch (eventType) {
      case OutboxEventType.TRANSACTION_CREATED:
        await this.processPurchase(content);
        break;
      case OutboxEventType.REFUND_REQUESTED:
        await this.processRefund(content);
        break;
      case OutboxEventType.CHARGEBACK_REQUESTED:
        await this.processChargeback(content);
        break;
      default:
        this.logger.warn(`Unknown event type: ${eventType}`);
    }
  }

  private async processPurchase(content: any): Promise<void> {
    try {
      const result = await this.acquiringBankService.processTransaction({
        transactionId: content.transactionId,
        amount: content.amount,
        currency: content.currency,
        token: content.token,
      });

      // Determine transaction status
      const status = result.success
        ? TransactionStatus.AUTHORIZED
        : TransactionStatus.FAILED;

      // Publish response to bank response queue
      // Transaction status + merchant balance will be updated atomically there
      const responseQueue =
        this.configService.get<string>('RABBITMQ_BANK_RESPONSE_QUEUE') ||
        'acquiring-bank.response.queue';
      await this.rabbitMQService.publishToQueue(responseQueue, {
        transactionId: content.transactionId,
        merchantId: content.merchantId,
        status,
        success: result.success,
        authorizationCode: result.authorizationCode,
        failureReason: result.declineReason,
        amount: content.amount,
      });

      this.logger.log(`Processed purchase ${content.transactionId}: ${status}`);
    } catch (error) {
      this.logger.error(`Failed to process purchase: ${error.message}`);
      // Set transaction to failed status directly
      await this.transactionModel.findByIdAndUpdate(content.transactionId, {
        status: TransactionStatus.FAILED,
        failureReason: 'Processing error',
      });
    }
  }

  private async processRefund(content: any): Promise<void> {
    try {
      const result = await this.acquiringBankService.processRefund(
        content.originalTransactionId,
        content.amount,
      );

      const status = result.success
        ? TransactionStatus.REFUNDED
        : TransactionStatus.FAILED;

      // Update original transaction's refunded amount if successful
      // This happens here because it's not related to balance
      if (result.success) {
        await this.transactionModel.findByIdAndUpdate(
          content.originalTransactionId,
          {
            $inc: { refundedAmount: content.amount },
          },
        );
      }

      // Publish response
      // Refund transaction status + merchant balance will be updated atomically there
      const responseQueue =
        this.configService.get<string>('RABBITMQ_BANK_RESPONSE_QUEUE') ||
        'acquiring-bank.response.queue';
      await this.rabbitMQService.publishToQueue(responseQueue, {
        transactionId: content.refundId,
        merchantId: content.merchantId,
        status,
        success: result.success,
        authorizationCode: result.authorizationCode,
        failureReason: result.declineReason,
        amount: content.amount,
        isRefund: true,
      });

      this.logger.log(`Processed refund ${content.refundId}: ${status}`);
    } catch (error) {
      this.logger.error(`Failed to process refund: ${error.message}`);
    }
  }

  private async processChargeback(content: any): Promise<void> {
    try {
      const result = await this.acquiringBankService.processChargeback(
        content.originalTransactionId,
        content.reason,
      );

      const status = TransactionStatus.CHARGEBACK;

      // Publish response
      // Chargeback transaction status + merchant balance will be updated atomically there
      const responseQueue =
        this.configService.get<string>('RABBITMQ_BANK_RESPONSE_QUEUE') ||
        'acquiring-bank.response.queue';
      await this.rabbitMQService.publishToQueue(responseQueue, {
        transactionId: content.chargebackId,
        merchantId: content.merchantId,
        status,
        success: true,
        authorizationCode: result.authorizationCode,
        amount: content.amount,
        isChargeback: true,
      });

      this.logger.log(
        `Processed chargeback ${content.chargebackId}: ${status}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process chargeback: ${error.message}`);
    }
  }
}
