import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
    description: 'Get audit logs with filters (Admin only)',
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
}

