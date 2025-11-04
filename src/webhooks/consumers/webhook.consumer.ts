import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { WebhookService } from '../services/webhook.service';

@Injectable()
export class WebhookConsumer implements OnModuleInit {
  private readonly logger = new Logger(WebhookConsumer.name);

  constructor(
    private rabbitMQService: RabbitMQService,
    private webhookService: WebhookService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const queueName = this.configService.get<string>('RABBITMQ_WEBHOOK_QUEUE') || 'webhook.queue';
    this.startConsuming(queueName);
  }

  private async startConsuming(queueName: string): Promise<void> {
    const channelWrapper = this.rabbitMQService.getChannelWrapper();

    await channelWrapper.addSetup(async (channel) => {
      // Assert queue exists before consuming
      await channel.assertQueue(queueName, { durable: true });
      
      await channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const content = JSON.parse(msg.content.toString());
            await this.processWebhook(content);
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
    } catch (error) {
      this.logger.error('Failed to deliver webhook:', error);
      // Webhook failures are logged but don't crash the system
    }
  }
}

