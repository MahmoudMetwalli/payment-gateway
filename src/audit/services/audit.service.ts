import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from '../schemas/audit-log.schema';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLog>,
  ) {}

  /**
   * Create an audit log entry with sanitized request details
   */
  async logAction(dto: CreateAuditLogDto): Promise<void> {
    try {
      // Sanitize request details before storing
      const sanitizedDetails = dto.requestDetails
        ? this.sanitizeRequestDetails(dto.requestDetails)
        : {};

      const auditLog = new this.auditLogModel({
        userId: dto.userId,
        userType: dto.userType,
        action: dto.action,
        resource: dto.resource,
        resourceId: dto.resourceId,
        requestDetails: sanitizedDetails,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        statusCode: dto.statusCode,
        errorMessage: dto.errorMessage,
        timestamp: new Date(),
      });

      await auditLog.save();
    } catch (error) {
      // Log errors but don't throw - audit logging should not break the main flow
      console.error('Failed to create audit log:', error);
    }
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
  private sanitizeRequestDetails(details: Record<string, any>): Record<string, any> {
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
}

