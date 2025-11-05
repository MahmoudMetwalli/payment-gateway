import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, UserType } from '../schemas/audit-log.schema';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLog>,
  ) {}

  /**
   * Create an audit log entry with sanitized request details (PCI DSS compliant)
   */
  async logAction(dto: CreateAuditLogDto): Promise<void> {
    try {
      // Sanitize request details before storing
      const sanitizedDetails = dto.requestDetails
        ? this.sanitizeRequestDetails(dto.requestDetails)
        : {};

      const sanitizedChanges = dto.changes
        ? {
            before: dto.changes.before
              ? this.sanitizeRequestDetails(dto.changes.before)
              : undefined,
            after: dto.changes.after
              ? this.sanitizeRequestDetails(dto.changes.after)
              : undefined,
          }
        : undefined;

      const now = new Date();
      // PCI DSS 10.5 - Retain logs for at least 12 months
      const retentionUntil = new Date(
        now.getTime() + 365 * 24 * 60 * 60 * 1000,
      ); // 12 months

      const auditLog = new this.auditLogModel({
        // User identification (PCI DSS 10.2.1)
        userId: dto.userId,
        userName: dto.userName,
        userType: dto.userType,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,

        // Event details (PCI DSS 10.2.2)
        action: dto.action,
        eventCategory: dto.eventCategory || this.categorizeEvent(dto.action),
        resource: dto.resource,
        resourceId: dto.resourceId,
        method: dto.method,
        endpoint: dto.endpoint,

        // Timestamp (PCI DSS 10.2.3)
        timestamp: now,

        // Success/Failure (PCI DSS 10.2.4)
        status: dto.status,
        statusCode: dto.statusCode,
        errorMessage: dto.errorMessage,

        // Origination (PCI DSS 10.2.5)
        sourceHost: dto.sourceHost,
        sourceDevice: dto.sourceDevice,

        // Data access (PCI DSS 10.2.6 & 10.2.7)
        dataAccessed: dto.dataAccessed || [],
        sensitiveDataAccessed: dto.sensitiveDataAccessed || false,
        cardholderDataAccess: dto.cardholderDataAccess || false,
        tokenIds: dto.tokenIds || [],

        // Additional context
        requestId: dto.requestId,
        sessionId: dto.sessionId,
        severity: dto.severity || this.determineSeverity(dto),
        changes: sanitizedChanges,
        requestDetails: sanitizedDetails,
        metadata: dto.metadata || {},

        // Retention
        retentionUntil,
      });

      await auditLog.save();
    } catch (error) {
      // Log errors but don't throw - audit logging should not break the main flow
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Categorize event based on action for PCI DSS compliance
   */
  private categorizeEvent(action: string): string {
    const actionLower = action.toLowerCase();

    if (
      actionLower.includes('login') ||
      actionLower.includes('logout') ||
      actionLower.includes('auth')
    ) {
      return 'authentication';
    }

    if (
      actionLower.includes('token') ||
      actionLower.includes('card') ||
      actionLower.includes('decrypt')
    ) {
      return 'cardholder_data_access';
    }

    if (
      actionLower.includes('create') ||
      actionLower.includes('update') ||
      actionLower.includes('delete')
    ) {
      return 'data_modification';
    }

    if (
      actionLower.includes('transaction') ||
      actionLower.includes('payment') ||
      actionLower.includes('refund')
    ) {
      return 'transaction_processing';
    }

    if (
      actionLower.includes('admin') ||
      actionLower.includes('config') ||
      actionLower.includes('setting')
    ) {
      return 'system_administration';
    }

    if (actionLower.includes('get') || actionLower.includes('view')) {
      return 'data_access';
    }

    return 'other';
  }

  /**
   * Determine severity based on event context
   */
  private determineSeverity(dto: CreateAuditLogDto): string {
    // Critical events
    if (
      dto.cardholderDataAccess ||
      dto.sensitiveDataAccessed ||
      dto.action.toLowerCase().includes('decrypt') ||
      dto.action.toLowerCase().includes('admin') ||
      dto.userType === UserType.ADMIN
    ) {
      return 'critical';
    }

    // High severity for failures on sensitive operations
    if (
      dto.status === 'failure' &&
      (dto.action.toLowerCase().includes('auth') ||
        dto.action.toLowerCase().includes('transaction'))
    ) {
      return 'high';
    }

    // Medium for modifications
    if (
      dto.method === 'POST' ||
      dto.method === 'PUT' ||
      dto.method === 'DELETE' ||
      dto.method === 'PATCH'
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(
    filters: QueryAuditLogsDto,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.userType) {
      query.userType = filters.userType;
    }

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.resource) {
      query.resource = filters.resource;
    }

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a specific audit log by ID
   */
  async getLogById(id: string): Promise<AuditLog | null> {
    return this.auditLogModel.findById(id).exec();
  }

  /**
   * Sanitize request details to remove sensitive information (PCI-DSS compliant)
   */
  private sanitizeRequestDetails(
    details: Record<string, any>,
  ): Record<string, any> {
    const sanitized = JSON.parse(JSON.stringify(details));

    // Recursively sanitize the object
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        // Remove CVV completely (PCI-DSS requirement)
        if (lowerKey.includes('cvv') || lowerKey.includes('cvc')) {
          result[key] = '[REDACTED]';
          continue;
        }

        // Mask card numbers (show only last 4)
        if (
          lowerKey.includes('card') &&
          (lowerKey.includes('number') || lowerKey.includes('pan'))
        ) {
          result[key] = this.maskCardNumber(String(value));
          continue;
        }

        // Mask API secrets
        if (
          lowerKey.includes('secret') ||
          lowerKey.includes('password') ||
          lowerKey.includes('token')
        ) {
          result[key] = '[REDACTED]';
          continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Mask card number showing only last 4 digits
   */
  private maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 4) {
      return '****';
    }

    const last4 = cardNumber.slice(-4);
    const masked = '*'.repeat(Math.max(0, cardNumber.length - 4));
    return masked + last4;
  }

  /**
   * Get all cardholder data access logs (PCI DSS 10.2.7)
   */
  async getCardholderDataAccessLogs(filters: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query: any = {
      cardholderDataAccess: true,
    };

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return { data: logs, total, page, limit };
  }

  /**
   * Get failed authentication attempts (PCI DSS 10.2.4)
   */
  async getFailedAuthentications(filters: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query: any = {
      eventCategory: 'authentication',
      status: 'failure',
    };

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return { data: logs, total, page, limit };
  }

  /**
   * Get critical severity events for daily review
   */
  async getCriticalEvents(filters: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query: any = {
      severity: 'critical',
    };

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return { data: logs, total, page, limit };
  }

  /**
   * Get complete audit trail for a specific user (PCI DSS 10.2.1)
   */
  async getUserAuditTrail(
    userId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const query: any = {
      userId,
    };

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return { data: logs, total, page, limit };
  }

  /**
   * Get complete audit trail for a transaction (all lifecycle events)
   */
  async getTransactionAuditTrail(transactionId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({
        resourceId: transactionId,
      })
      .sort({ timestamp: 1 }) // Chronological order
      .exec();
  }

  /**
   * Get daily audit summary for compliance review
   */
  async getDailySummary(date: Date): Promise<{
    date: string;
    totalEvents: number;
    failedAuthentications: number;
    cardholderDataAccess: number;
    criticalEvents: number;
    transactionProcessing: number;
    systemAdministration: number;
    dataModifications: number;
    topUsers: Array<{ userId: string; userName: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      timestamp: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    // Get various counts in parallel
    const [
      totalEvents,
      failedAuthentications,
      cardholderDataAccess,
      criticalEvents,
      transactionProcessing,
      systemAdministration,
      dataModifications,
      topUsersData,
      topActionsData,
    ] = await Promise.all([
      this.auditLogModel.countDocuments(query),
      this.auditLogModel.countDocuments({
        ...query,
        eventCategory: 'authentication',
        status: 'failure',
      }),
      this.auditLogModel.countDocuments({
        ...query,
        cardholderDataAccess: true,
      }),
      this.auditLogModel.countDocuments({
        ...query,
        severity: 'critical',
      }),
      this.auditLogModel.countDocuments({
        ...query,
        eventCategory: 'transaction_processing',
      }),
      this.auditLogModel.countDocuments({
        ...query,
        eventCategory: 'system_administration',
      }),
      this.auditLogModel.countDocuments({
        ...query,
        eventCategory: 'data_modification',
      }),
      this.auditLogModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: { userId: '$userId', userName: '$userName' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      this.auditLogModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalEvents,
      failedAuthentications,
      cardholderDataAccess,
      criticalEvents,
      transactionProcessing,
      systemAdministration,
      dataModifications,
      topUsers: topUsersData.map((u: any) => ({
        userId: u._id.userId,
        userName: u._id.userName,
        count: u.count,
      })),
      topActions: topActionsData.map((a: any) => ({
        action: a._id,
        count: a.count,
      })),
    };
  }
}
