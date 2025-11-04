import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WithdrawalDocument = HydratedDocument<Withdrawal>;

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Withdrawal {
  _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Merchant', index: true })
  merchantId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0 })
  amount: number;

  @Prop({ required: true, enum: Object.values(WithdrawalStatus), default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;

  @Prop({ type: String })
  bankAccountLast4: string;

  @Prop({ type: Date })
  processedAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);

WithdrawalSchema.index({ merchantId: 1, createdAt: -1 });

