import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class HmacService {
  /**
   * Generate HMAC-SHA256 signature
   */
  generateSignature(payload: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Validate HMAC signature using timing-safe comparison
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, secret);

      // Convert to buffers for timing-safe comparison
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const providedBuffer = Buffer.from(signature, 'utf8');

      // Check lengths match first
      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      return timingSafeEqual(expectedBuffer, providedBuffer);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create payload string from request body and timestamp
   */
  createPayload(body: any, timestamp: string): string {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    return `${timestamp}.${bodyString}`;
  }

  /**
   * Validate timestamp is within acceptable window
   */
  validateTimestamp(timestamp: string, toleranceSeconds: number = 300): boolean {
    try {
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const difference = Math.abs(currentTime - requestTime);

      return difference <= toleranceSeconds;
    } catch (error) {
      return false;
    }
  }
}

