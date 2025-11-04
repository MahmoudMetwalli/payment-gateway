import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HmacService } from '../services/hmac.service';
import { HmacRequest } from '../interfaces/hmac-request.interface';
import { MERCHANTS_SERVICE } from 'src/merchants/interfaces';
import type { IMerchantsService } from 'src/merchants/interfaces';

@Injectable()
export class HmacGuard implements CanActivate {
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

    // Validate headers are present
    if (!apiKey || !signature || !timestamp) {
      throw new UnauthorizedException(
        'Missing required HMAC headers (X-API-Key, X-Signature, X-Timestamp)',
      );
    }

    // Validate timestamp to prevent replay attacks
    const timestampTolerance =
      this.configService.get<number>('HMAC_TIMESTAMP_TOLERANCE') || 300;
    if (!this.hmacService.validateTimestamp(timestamp, timestampTolerance)) {
      throw new UnauthorizedException(
        'Request timestamp is outside acceptable window',
      );
    }

    // Fetch merchant by API key
    let merchantCreds;
    try {
      merchantCreds = await this.merchantsService.findByApiKey(apiKey);
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Create payload from timestamp and body
    const payload = this.hmacService.createPayload(request.body, timestamp);

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

