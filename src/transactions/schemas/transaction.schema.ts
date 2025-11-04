import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIAL_REFUND = 'partial_refund',
  CHARGEBACK = 'chargeback',
}

export enum TransactionType {
  PURCHASE = 'purchase',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
}

@Schema({ timestamps: true })
export class Transaction {
  _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Merchant', index: true })
  merchantId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0 })
  amount: number;

  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({
    required: true,
    enum: Object.values(TransactionStatus),
    index: true,
  })
  status: TransactionStatus;

  @Prop({ required: true, enum: Object.values(TransactionType) })
  type: TransactionType;

  @Prop({ type: String })
  tokenizedCardId: string;

  @Prop({ type: String })
  cardLast4: string;

  @Prop({ type: String })
  cardBrand: string;

  @Prop({ type: String })
  authorizationCode: string;

  @Prop({ type: String })
  failureReason: string;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  originalTransactionId: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  refundedAmount: number;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Indexes for performance
TransactionSchema.index({ merchantId: 1, createdAt: -1 });
TransactionSchema.index({ merchantId: 1, status: 1 });
TransactionSchema.index({ status: 1, createdAt: -1 });

