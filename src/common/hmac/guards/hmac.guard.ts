import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HmacService } from '../services/hmac.service';
import { HmacRequest } from '../interfaces/hmac-request.interface';
import { MERCHANTS_SERVICE } from 'src/merchants/interfaces';
import type { IMerchantsService } from 'src/merchants/interfaces';

@Injectable()
export class HmacGuard implements CanActivate {
  private readonly logger = new Logger(HmacGuard.name);

  constructor(
    private hmacService: HmacService,
    private configService: ConfigService,
    @Inject(MERCHANTS_SERVICE)
    private merchantsService: IMerchantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HmacRequest>();

    // Extract headers
    const apiKey = request.headers['x-api-key'] as string;
    const signature = request.headers['x-signature'] as string;
    const timestamp = request.headers['x-timestamp'] as string;

    // Log incoming request for debugging
    this.logger.debug(`HMAC request: ${request.method} ${request.url}`);
    this.logger.debug(
      `Headers: x-api-key=${apiKey?.substring(0, 10)}..., x-signature=${signature?.substring(0, 16)}..., x-timestamp=${timestamp}`,
    );

    // Log the raw body as received (before normalization) for comparison
    const rawBodyString = request.body ? JSON.stringify(request.body) : '';
    this.logger.debug(
      `Raw body received (${rawBodyString.length} chars): ${rawBodyString.substring(0, 150)}${rawBodyString.length > 150 ? '...' : ''}`,
    );

    // Validate headers are present
    if (!apiKey || !signature || !timestamp) {
      this.logger.warn(
        `Missing HMAC headers for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException(
        'Missing required HMAC headers (X-API-Key, X-Signature, X-Timestamp)',
      );
    }

    // Validate timestamp to prevent replay attacks
    const timestampTolerance =
      this.configService.get<number>('HMAC_TIMESTAMP_TOLERANCE') || 300;
    if (!this.hmacService.validateTimestamp(timestamp, timestampTolerance)) {
      this.logger.warn(
        `Invalid timestamp for ${request.method} ${request.url}: ${timestamp}`,
      );
      throw new UnauthorizedException(
        'Request timestamp is outside acceptable window',
      );
    }

    // Fetch merchant by API key
    let merchantCreds;
    try {
      merchantCreds = await this.merchantsService.findByApiKey(apiKey);
    } catch (error) {
      this.logger.warn(`Invalid API key: ${apiKey?.substring(0, 10)}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    // Create payload from timestamp and body
    // Note: request.body is already parsed by Express, so we need to stringify it
    const payload = this.hmacService.createPayload(request.body, timestamp);

    // Log full payload for debugging (first 500 chars)
    this.logger.debug(
      `Body type: ${typeof request.body}, Body keys: ${request.body ? Object.keys(request.body).join(', ') : 'empty'}`,
    );

    // Log the body string separately to see what we're signing
    const bodyString = payload.substring(timestamp.length + 1); // Remove timestamp. prefix
    this.logger.debug(
      `Body string (${bodyString.length} chars): ${bodyString.substring(0, 200)}${bodyString.length > 200 ? '...' : ''}`,
    );

    // Validate signature
    const isValid = this.hmacService.validateSignature(
      payload,
      signature,
      merchantCreds.apiSecret,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Attach merchant info to request for use in controllers
    request.merchant = {
      id: merchantCreds.id,
      apiKey: merchantCreds.apiKey,
      apiSecret: merchantCreds.apiSecret,
    };

    return true;
  }
}
