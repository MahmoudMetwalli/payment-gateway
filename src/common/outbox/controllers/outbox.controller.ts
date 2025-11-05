import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OutboxService } from '../services/outbox.service';

@ApiTags('Outbox Management')
@Controller('admin/outbox')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('Admin-JWT-auth')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Get('statistics')
  @ApiOperation({
    summary: 'Get outbox statistics',
    description:
      'Get counts of pending, processing, completed, and failed outbox entries',
  })
  @ApiResponse({ status: 200, description: 'Outbox statistics' })
  async getStatistics() {
    return this.outboxService.getStatistics();
  }

  @Get('failed')
  @ApiOperation({
    summary: 'Get permanently failed outbox entries',
    description:
      'Get entries that exceeded maximum retry attempts and require manual intervention',
  })
  @ApiResponse({ status: 200, description: 'List of failed entries' })
  async getFailedEntries() {
    const entries = await this.outboxService.getPermanentlyFailedEntries();
    return {
      count: entries.length,
      entries: entries.map((e) => ({
        id: e._id,
        aggregateId: e.aggregateId,
        eventType: e.eventType,
        retryCount: e.retryCount,
        errorMessage: e.errorMessage,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    };
  }

  @Post('retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually retry all failed entries',
    description:
      'Reset failed entries (that have not exceeded max retries) back to pending status',
  })
  @ApiResponse({ status: 200, description: 'Failed entries reset for retry' })
  async retryFailed() {
    await this.outboxService.retryFailed();
    return {
      message: 'Failed entries reset for retry',
    };
  }

  @Post('failed/:id/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset specific failed entry',
    description:
      'Manually reset a permanently failed entry to pending (bypasses max retry limit)',
  })
  @ApiResponse({ status: 200, description: 'Entry reset successfully' })
  async resetFailedEntry(@Param('id') id: string) {
    await this.outboxService.resetFailedEntry(id);
    return {
      message: `Entry ${id} reset to pending status`,
    };
  }
}
