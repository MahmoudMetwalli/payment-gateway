import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import {
  DLXSetupService,
  DLQRoutingKey,
} from 'src/common/rabbitmq/dlx-setup.service';
import { UnityOfWorkService } from 'src/common/database/unity-of-work.service';
import { OutboxService } from 'src/common/outbox/services/outbox.service';
import { OutboxEventType } from 'src/common/outbox/schemas/outbox.schema';
import { Transaction } from '../schemas/transaction.schema';
import { MERCHANTS_SERVICE } from 'src/merchants/interfaces';
import type { IMerchantTransactionManager } from 'src/merchants/interfaces';

@Injectable()
export class BankResponseConsumer implements OnModuleInit {
  private readonly logger = new Logger(BankResponseConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private dlxSetup: DLXSetupService,
    private unityOfWork: UnityOfWorkService,
    private outboxService: OutboxService,
    private configService: ConfigService,
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
    @Inject(MERCHANTS_SERVICE)
    private merchantTransactionManager: IMerchantTransactionManager,
  ) {}

  async onModuleInit() {
    const queueName =
      this.configService.get<string>('RABBITMQ_BANK_RESPONSE_QUEUE') ||
      'acquiring-bank.response.queue';
    this.startConsuming(queueName);
  }

  private async startConsuming(queueName: string): Promise<void> {
    const channelWrapper = this.rabbitMQService.getChannelWrapper();

    await channelWrapper.addSetup(async (channel) => {
      // DLX already setup by RabbitMQService
      // Just assert queue with DLX options
      await channel.assertQueue(
        queueName,
        this.dlxSetup.getQueueOptions(DLQRoutingKey.BANK_RESPONSE),
      );

      await channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const content = JSON.parse(msg.content.toString());
            await this.processResponse(content);
            channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing bank response:', error);
            channel.nack(msg, false, false);
          }
        },
        { noAck: false },
      );
    });

    this.logger.log(`Started consuming from queue: ${queueName}`);
  }

  private async processResponse(content: any): Promise<void> {
    try {
      // Execute all operations within a transaction
      await this.unityOfWork.execute(async (session) => {
        // Update transaction status first
        await this.transactionModel.findByIdAndUpdate(
          content.transactionId,
          {
            status: content.status,
            authorizationCode: content.authorizationCode,
            failureReason: content.failureReason,
          },
          { session },
        );
        this.logger.log(
          `Updated transaction ${content.transactionId} status to ${content.status}`,
        );

        // Update merchant balance if transaction was successful
        if (content.success && !content.isRefund && !content.isChargeback) {
          await this.merchantTransactionManager.updateBalance(
            {
              id: content.merchantId,
              amount: content.amount,
            },
            session,
          );
          this.logger.log(
            `Updated merchant ${content.merchantId} balance by +${content.amount}`,
          );
        }

        // Deduct from balance for refunds and chargebacks
        if ((content.isRefund || content.isChargeback) && content.success) {
          await this.merchantTransactionManager.updateBalance(
            {
              id: content.merchantId,
              amount: -content.amount,
            },
            session,
          );
          this.logger.log(
            `Updated merchant ${content.merchantId} balance by -${content.amount}`,
          );
        }

        // Create webhook notification outbox entry
        await this.outboxService.createOutboxEntry(
          {
            aggregateId: content.transactionId,
            eventType: OutboxEventType.WEBHOOK_NOTIFICATION,
            payload: {
              merchantId: content.merchantId,
              transactionId: content.transactionId,
              status: content.status,
              success: content.success,
              authorizationCode: content.authorizationCode,
              failureReason: content.failureReason,
              amount: content.amount,
              isRefund: content.isRefund || false,
              isChargeback: content.isChargeback || false,
              timestamp: new Date().toISOString(),
            },
          },
          session,
        );

        this.logger.log(
          `Created webhook notification for transaction ${content.transactionId}`,
        );
      });
    } catch (error) {
      this.logger.error(`Failed to process bank response: ${error.message}`);
      throw error;
    }
  }
}
