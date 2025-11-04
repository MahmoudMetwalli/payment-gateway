import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inbox, InboxStatus } from '../schemas/inbox.schema';

@Injectable()
export class InboxService {
  constructor(
    @InjectModel(Inbox.name)
    private inboxModel: Model<Inbox>,
  ) {}

  /**
   * Check if message has already been processed (idempotency)
   */
  async isProcessed(messageId: string): Promise<boolean> {
    const existing = await this.inboxModel.findOne({ messageId });
    return !!existing;
  }

  /**
   * Mark message as processed
   */
  async markAsProcessed(
    messageId: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const inbox = new this.inboxModel({
      messageId,
      eventType,
      payload,
      status: InboxStatus.PROCESSED,
      processedAt: new Date(),
    });

    try {
      await inbox.save();
    } catch (error) {
      // If duplicate key error, message was already processed concurrently
      if (error.code === 11000) {
        return;
      }
      throw error;
    }
  }

  /**
   * Mark message as failed
   */
  async markAsFailed(
    messageId: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await this.inboxModel.create({
      messageId,
      eventType,
      payload,
      status: InboxStatus.FAILED,
    });
  }
}

