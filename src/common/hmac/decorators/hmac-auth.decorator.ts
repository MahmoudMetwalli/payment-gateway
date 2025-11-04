import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiSecurity } from '@nestjs/swagger';
import { HmacGuard } from '../guards/hmac.guard';

/**
 * Decorator to protect routes with HMAC authentication
 * Automatically adds Swagger documentation for HMAC headers
 */
export function HmacAuth() {
  return applyDecorators(
    UseGuards(HmacGuard),
    // Mark these routes as requiring HMAC-related security schemes
    ApiSecurity('HMAC-API-Key'),
    ApiSecurity('HMAC-Signature'),
    ApiSecurity('HMAC-Timestamp'),
    ApiHeader({
      name: 'X-API-Key',
      description: 'Merchant API Key (auto-filled by HMAC Helper)',
      required: false,
      schema: { type: 'string' },
    }),
    ApiHeader({
      name: 'X-Signature',
      description: 'HMAC-SHA256 signature of timestamp.body (auto-generated)',
      required: false,
      schema: { type: 'string' },
    }),
    ApiHeader({
      name: 'X-Timestamp',
      description: 'Unix timestamp in seconds (auto-generated)',
      required: false,
      schema: { type: 'string' },
    }),
  );
}

