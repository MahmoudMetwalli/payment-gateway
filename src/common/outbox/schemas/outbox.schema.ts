import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OutboxDocument = HydratedDocument<Outbox>;

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum OutboxEventType {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_AUTHORIZED = 'TRANSACTION_AUTHORIZED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  CHARGEBACK_REQUESTED = 'CHARGEBACK_REQUESTED',
  WEBHOOK_NOTIFICATION = 'WEBHOOK_NOTIFICATION',
}

@Schema({ timestamps: true })
export class Outbox {
  _id: Types.ObjectId;

  @Prop({ required: true, type: String })
  aggregateId: string;

  @Prop({ required: true, enum: Object.values(OutboxEventType) })
  eventType: OutboxEventType;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ required: true, enum: Object.values(OutboxStatus), index: true })
  status: OutboxStatus;

  @Prop({ type: Date })
  processedAt: Date;

  @Prop({ type: Number, default: 0 })
  retryCount: number;

  @Prop({ type: String })
  errorMessage: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const OutboxSchema = SchemaFactory.createForClass(Outbox);

// Index for efficient polling
OutboxSchema.index({ status: 1, createdAt: 1 });
OutboxSchema.index({ aggregateId: 1 });
// Index for retry logic and cleanup
OutboxSchema.index({ status: 1, retryCount: 1 });
OutboxSchema.index({ status: 1, processedAt: 1 });
