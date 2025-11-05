import { Injectable, Logger } from '@nestjs/common';
import { ConfirmChannel } from 'amqplib';

export enum DLQRoutingKey {
  TRANSACTION = 'transaction',
  WEBHOOK = 'webhook',
  BANK_RESPONSE = 'bank.response',
}

@Injectable()
export class DLXSetupService {
  private readonly logger = new Logger(DLXSetupService.name);
  private readonly DLX_NAME = 'dlx.shared';
  private isSetup = false;

  /**
   * Setup shared dead letter exchange and queues
   */
  async setupDLX(channel: ConfirmChannel): Promise<void> {
    if (this.isSetup) return;

    try {
      // Create shared DLX
      await channel.assertExchange(this.DLX_NAME, 'direct', {
        durable: true,
      });

      // Create DLQs for different message types
      const dlqConfigs = [
        { queue: 'dlq.transactions', routingKey: DLQRoutingKey.TRANSACTION },
        { queue: 'dlq.webhooks', routingKey: DLQRoutingKey.WEBHOOK },
        {
          queue: 'dlq.bank.responses',
          routingKey: DLQRoutingKey.BANK_RESPONSE,
        },
      ];

      for (const config of dlqConfigs) {
        await channel.assertQueue(config.queue, {
          durable: true,
          arguments: {
            'x-message-ttl': 86400000, // 24 hours retention
            'x-max-length': 10000, // Max 10k messages
          },
        });

        await channel.bindQueue(config.queue, this.DLX_NAME, config.routingKey);

        this.logger.log(`DLQ setup: ${config.queue} → ${config.routingKey}`);
      }

      this.isSetup = true;
      this.logger.log('Shared DLX setup completed');
    } catch (error) {
      this.logger.error('Failed to setup DLX:', error);
      throw error;
    }
  }

  /**
   * Get queue options with DLX configuration
   */
  getQueueOptions(routingKey: DLQRoutingKey) {
    return {
      durable: true,
      deadLetterExchange: this.DLX_NAME,
      deadLetterRoutingKey: routingKey,
    };
  }
}
