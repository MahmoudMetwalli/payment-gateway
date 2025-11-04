import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InboxDocument = HydratedDocument<Inbox>;

export enum InboxStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Inbox {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  messageId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ required: true, enum: Object.values(InboxStatus) })
  status: InboxStatus;

  @Prop({ type: Date })
  processedAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const InboxSchema = SchemaFactory.createForClass(Inbox);

