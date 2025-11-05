import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmChannel } from 'amqplib';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import {
  DLXSetupService,
  DLQRoutingKey,
} from 'src/common/rabbitmq/dlx-setup.service';
import { InboxService } from 'src/common/inbox/services/inbox.service';
import { WebhookService } from '../services/webhook.service';
import { AuditService } from 'src/audit/services/audit.service';
import { UserType, AuditStatus } from 'src/audit/schemas/audit-log.schema';

@Injectable()
export class WebhookConsumer implements OnModuleInit {
  private readonly logger = new Logger(WebhookConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private dlxSetup: DLXSetupService,
    private inboxService: InboxService,
    private webhookService: WebhookService,
    private configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    const queueName =
      this.configService.get<string>('RABBITMQ_WEBHOOK_QUEUE') ||
      'webhook.queue';
    this.startConsuming(queueName);
  }

  private async startConsuming(queueName: string): Promise<void> {
    const channelWrapper = this.rabbitMQService.getChannelWrapper();

    await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
      // DLX already setup by RabbitMQService
      // Just assert queue with DLX options
      await channel.assertQueue(
        queueName,
        this.dlxSetup.getQueueOptions(DLQRoutingKey.WEBHOOK),
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

            await this.processWebhook(content);
            await this.inboxService.markAsProcessed(
              messageId,
              'WEBHOOK_NOTIFICATION',
              content,
            );

            channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing webhook:', error);
            // Don't requeue failed webhooks
            channel.nack(msg, false, false);
          }
        },
        { noAck: false },
      );
    });

    this.logger.log(`Started consuming from queue: ${queueName}`);
  }

  private async processWebhook(content: any): Promise<void> {
    try {
      await this.webhookService.deliverWebhook(content.merchantId, content);
      this.logger.log(
        `Processed webhook for merchant ${content.merchantId}, transaction ${content.transactionId}`,
      );

      // PCI DSS - Log webhook delivery (sensitive data transmission)
      await this.auditService.logAction({
        userId: 'webhook-service',
        userType: UserType.SYSTEM,
        ipAddress: 'internal',
        action: 'WEBHOOK_DELIVERED',
        eventCategory: 'data_transmission',
        resource: 'webhooks',
        resourceId: content.transactionId,
        method: 'INTERNAL',
        endpoint: 'webhook.consumer',
        status: AuditStatus.SUCCESS,
        statusCode: 200,
        sensitiveDataAccessed: true,
        dataAccessed: ['transaction', 'financial_data'],
        metadata: {
          merchantId: content.merchantId,
          transactionId: content.transactionId,
          transactionStatus: content.status,
          amount: content.amount,
          isRefund: content.isRefund,
          isChargeback: content.isChargeback,
        },
      });
    } catch (error) {
      this.logger.error('Failed to deliver webhook:', error);

      // PCI DSS - Log failed webhook delivery
      await this.auditService.logAction({
        userId: 'webhook-service',
        userType: UserType.SYSTEM,
        ipAddress: 'internal',
        action: 'WEBHOOK_DELIVERED',
        eventCategory: 'data_transmission',
        resource: 'webhooks',
        resourceId: content.transactionId,
        method: 'INTERNAL',
        endpoint: 'webhook.consumer',
        status: AuditStatus.FAILURE,
        statusCode: 500,
        errorMessage: error.message,
        sensitiveDataAccessed: true,
        dataAccessed: ['transaction'],
        metadata: {
          merchantId: content.merchantId,
          transactionId: content.transactionId,
          transactionStatus: content.status,
        },
      });

      throw error; // Re-throw to trigger nack and send to DLQ
    }
  }
}
