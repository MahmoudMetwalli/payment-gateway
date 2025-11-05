import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum UserType {
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Schema({ timestamps: true })
export class AuditLog {
  _id: Types.ObjectId;

  // PCI DSS 10.2.1 - User Identification
  @Prop({ required: true })
  userId: string;

  @Prop({ type: String })
  userName: string;

  @Prop({ required: true, enum: Object.values(UserType) })
  userType: UserType;

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ type: String })
  userAgent: string;

  // PCI DSS 10.2.2 - Type of Event
  @Prop({ required: true })
  action: string;

  @Prop({ type: String })
  eventCategory: string; // authentication, data_access, system_change, etc.

  @Prop({ required: true })
  resource: string;

  @Prop({ type: String })
  resourceId: string;

  @Prop({ required: true })
  method: string; // GET, POST, PUT, DELETE, PATCH

  @Prop({ type: String })
  endpoint: string;

  // PCI DSS 10.2.3 - Date and Time
  @Prop({ required: true })
  timestamp: Date;

  // PCI DSS 10.2.4 - Success or Failure
  @Prop({ required: true, enum: Object.values(AuditStatus) })
  status: AuditStatus;

  @Prop({ type: Number })
  statusCode: number;

  @Prop({ type: String })
  errorMessage: string;

  // PCI DSS 10.2.5 - Origination of Event
  @Prop({ type: String })
  sourceHost: string;

  @Prop({ type: String })
  sourceDevice: string;

  // PCI DSS 10.2.6 - Identity of Affected Data/Resource
  @Prop({ type: [String], default: [] })
  dataAccessed: string[]; // Types of data accessed (e.g., ['transaction', 'merchant_balance'])

  @Prop({ type: Boolean, default: false })
  sensitiveDataAccessed: boolean; // Flag for cardholder data access

  // PCI DSS 10.2.7 - Individual Access to Cardholder Data
  @Prop({ type: Boolean, default: false })
  cardholderDataAccess: boolean;

  @Prop({ type: [String], default: [] })
  tokenIds: string[]; // Token IDs accessed (not the actual card data)

  // Additional security context
  @Prop({ type: String })
  requestId: string; // For correlation across logs

  @Prop({ type: String })
  sessionId: string;

  @Prop({
    type: String,
    enum: Object.values(EventSeverity),
    default: EventSeverity.LOW,
  })
  severity: EventSeverity;

  // Changes made (for audit trail)
  @Prop({ type: Object })
  changes: {
    before?: any;
    after?: any;
  };

  // Request details (sanitized)
  @Prop({ type: Object })
  requestDetails: Record<string, any>;

  // Additional metadata
  @Prop({ type: Object })
  metadata: Record<string, any>;

  // Retention flag (for PCI DSS 10.5 compliance)
  @Prop({ type: Date })
  retentionUntil: Date; // Auto-calculated: timestamp + 12 months
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for PCI DSS compliance
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ status: 1, timestamp: -1 });
AuditLogSchema.index({ cardholderDataAccess: 1, timestamp: -1 });
AuditLogSchema.index({ sensitiveDataAccessed: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 }); // For daily log reviews
AuditLogSchema.index({ retentionUntil: 1 }); // For automated cleanup
AuditLogSchema.index({ resource: 1, timestamp: -1 });
