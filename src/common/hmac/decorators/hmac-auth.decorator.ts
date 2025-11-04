import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { HmacGuard } from '../guards/hmac.guard';

/**
 * Decorator to protect routes with HMAC authentication
 * Automatically adds Swagger documentation for HMAC headers
 */
export function HmacAuth() {
  return applyDecorators(
    UseGuards(HmacGuard),
    ApiHeader({
      name: 'X-API-Key',
      description: 'Merchant API Key',
      required: true,
      schema: { type: 'string' },
    }),
    ApiHeader({
      name: 'X-Signature',
      description: 'HMAC-SHA256 signature of timestamp.body',
      required: true,
      schema: { type: 'string' },
    }),
    ApiHeader({
      name: 'X-Timestamp',
      description: 'Unix timestamp in seconds',
      required: true,
      schema: { type: 'string' },
    }),
  );
}

