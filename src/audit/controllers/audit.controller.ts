import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Audit Logs')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('Admin-JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Query audit logs',
    description:
      'Get audit logs with filters (Admin only - PCI DSS Compliance)',
  })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async queryLogs(@Query() filters: QueryAuditLogsDto) {
    return this.auditService.queryLogs(filters);
  }

  @Get('logs/:id')
  @ApiOperation({
    summary: 'Get audit log by ID',
    description: 'Retrieve a specific audit log entry (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Audit log details' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async getLog(@Param('id') id: string) {
    return this.auditService.getLogById(id);
  }

  @Get('cardholder-data-access')
  @ApiOperation({
    summary: 'Get cardholder data access logs',
    description:
      'Retrieve all logs where cardholder data was accessed (PCI DSS 10.2.7)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cardholder data access audit logs',
  })
  async getCardholderDataAccess(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.auditService.getCardholderDataAccessLogs({
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('failed-authentications')
  @ApiOperation({
    summary: 'Get failed authentication attempts',
    description:
      'Retrieve all failed login attempts for security monitoring (PCI DSS 10.2.4)',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed authentication attempts',
  })
  async getFailedAuthentications(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.auditService.getFailedAuthentications({
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('critical-events')
  @ApiOperation({
    summary: 'Get critical security events',
    description:
      'Retrieve all critical severity events for daily review (PCI DSS Requirement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Critical security events',
  })
  async getCriticalEvents(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.auditService.getCriticalEvents({
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get audit trail for specific user',
    description:
      'Retrieve complete audit trail for a user (PCI DSS 10.2.1 - User Identification)',
  })
  @ApiResponse({
    status: 200,
    description: 'User audit trail',
  })
  async getUserAuditTrail(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.auditService.getUserAuditTrail(userId, {
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('transaction/:transactionId')
  @ApiOperation({
    summary: 'Get complete audit trail for a transaction',
    description:
      'Retrieve all audit logs related to a specific transaction lifecycle',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction audit trail',
  })
  async getTransactionAuditTrail(
    @Param('transactionId') transactionId: string,
  ) {
    return this.auditService.getTransactionAuditTrail(transactionId);
  }

  @Get('summary/daily')
  @ApiOperation({
    summary: 'Get daily audit summary',
    description:
      'Get summary statistics for daily log review (PCI DSS daily review requirement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily audit summary statistics',
  })
  async getDailySummary(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return this.auditService.getDailySummary(targetDate);
  }
}
