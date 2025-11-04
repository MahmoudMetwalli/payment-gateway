import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum UserType {
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: Object.values(UserType) })
  userType: UserType;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  resource: string;

  @Prop({ type: String })
  resourceId: string;

  @Prop({ type: Object })
  requestDetails: Record<string, any>;

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ type: String })
  userAgent: string;

  @Prop({ type: Number })
  statusCode: number;

  @Prop({ type: String })
  errorMessage: string;

  @Prop({ required: true, index: true })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Compound indexes for common queries
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, timestamp: -1 });

