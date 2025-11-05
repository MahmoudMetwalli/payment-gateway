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

  /**
   * Delete completed entries older than the specified date
   */
  async deleteCompletedBefore(
    cutoffDate: Date,
  ): Promise<{ deletedCount: number }> {
    const result = await this.outboxModel.deleteMany({
      status: OutboxStatus.COMPLETED,
      processedAt: { $lt: cutoffDate },
    });

    return { deletedCount: result.deletedCount || 0 };
  }

  /**
   * Get permanently failed entries (exceeded max retries)
   */
  async getPermanentlyFailedEntries(maxRetries: number = 3): Promise<Outbox[]> {
    return this.outboxModel
      .find({
        status: OutboxStatus.FAILED,
        retryCount: { $gte: maxRetries },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get outbox statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    permanentlyFailed: number;
  }> {
    const maxRetries = 3;

    const [pending, processing, completed, failed, permanentlyFailed] =
      await Promise.all([
        this.outboxModel.countDocuments({ status: OutboxStatus.PENDING }),
        this.outboxModel.countDocuments({ status: OutboxStatus.PROCESSING }),
        this.outboxModel.countDocuments({ status: OutboxStatus.COMPLETED }),
        this.outboxModel.countDocuments({
          status: OutboxStatus.FAILED,
          retryCount: { $lt: maxRetries },
        }),
        this.outboxModel.countDocuments({
          status: OutboxStatus.FAILED,
          retryCount: { $gte: maxRetries },
        }),
      ]);

    return {
      pending,
      processing,
      completed,
      failed,
      permanentlyFailed,
    };
  }

  /**
   * Manually reset a permanently failed entry (bypasses max retry limit)
   */
  async resetFailedEntry(id: string): Promise<void> {
    await this.outboxModel.findByIdAndUpdate(id, {
      status: OutboxStatus.PENDING,
      retryCount: 0,
      errorMessage: null,
    });
  }
}
