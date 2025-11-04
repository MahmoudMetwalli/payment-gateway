import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rabbitMQUrl = this.configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672';

    this.connection = amqp.connect([rabbitMQUrl], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () => {
      console.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      console.error('Disconnected from RabbitMQ:', err);
    });

    this.channelWrapper = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        // Declare queues
        await channel.assertQueue(
          this.configService.get<string>('RABBITMQ_TRANSACTION_QUEUE') || 'transaction.queue',
          { durable: true },
        );
        await channel.assertQueue(
          this.configService.get<string>('RABBITMQ_BANK_RESPONSE_QUEUE') || 'acquiring-bank.response.queue',
          { durable: true },
        );
        await channel.assertQueue(
          this.configService.get<string>('RABBITMQ_WEBHOOK_QUEUE') || 'webhook.queue',
          { durable: true },
        );
      },
    });
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
  }

  /**
   * Publish message to a queue
   */
  async publishToQueue(queue: string, message: any): Promise<void> {
    try {
      await this.channelWrapper.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        { persistent: true },
      );
    } catch (error) {
      console.error(`Failed to publish to queue ${queue}:`, error);
      throw error;
    }
  }

  /**
   * Get channel wrapper for consuming messages
   */
  getChannelWrapper(): ChannelWrapper {
    return this.channelWrapper;
  }
}

