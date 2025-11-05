import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Outbox, OutboxStatus } from '../schemas/outbox.schema';
import { CreateOutboxDto } from '../dto/create-outbox.dto';

@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(Outbox.name)
    private outboxModel: Model<Outbox>,
  ) {}

  /**
   * Create an outbox entry
   */
  async createOutboxEntry(
    dto: CreateOutboxDto,
    session?: ClientSession,
  ): Promise<Outbox> {
    const outboxEntry = new this.outboxModel({
      aggregateId: dto.aggregateId,
      eventType: dto.eventType,
      payload: dto.payload,
      status: OutboxStatus.PENDING,
      retryCount: 0,
    });

    return outboxEntry.save({ session });
  }

  /**
   * Get pending outbox entries for processing
   */
  async getPendingEntries(limit: number): Promise<Outbox[]> {
    return this.outboxModel
      .find({ status: OutboxStatus.PENDING })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Mark entries as processing
   */
  async markAsProcessing(ids: string[]): Promise<void> {
    await this.outboxModel.updateMany(
      { _id: { $in: ids } },
      { status: OutboxStatus.PROCESSING },
    );
  }

  /**
   * Mark entry as completed
   */
  async markAsCompleted(id: string): Promise<void> {
    await this.outboxModel.findByIdAndUpdate(id, {
      status: OutboxStatus.COMPLETED,
      processedAt: new Date(),
    });
  }

  /**
   * Mark entry as failed with error message
   */
  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    await this.outboxModel.findByIdAndUpdate(id, {
      status: OutboxStatus.FAILED,
      errorMessage,
      $inc: { retryCount: 1 },
    });
  }

  /**
   * Reset failed entries to pending for retry (with limit on retry count)
   */
  async retryFailed(maxRetries: number = 3): Promise<void> {
    await this.outboxModel.updateMany(
      {
        status: OutboxStatus.FAILED,
        retryCount: { $lt: maxRetries },
      },
      { status: OutboxStatus.PENDING },
    );
  }
}
