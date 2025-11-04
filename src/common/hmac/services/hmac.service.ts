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
   * Uses deterministic JSON stringification to ensure consistent signatures
   */
  createPayload(body: any, timestamp: string): string {
    let bodyString = '';
    
    if (body === null || body === undefined) {
      bodyString = '';
    } else if (typeof body === 'string') {
      // If it's already a string, try to parse and re-stringify to normalize
      try {
        const parsed = JSON.parse(body);
        const normalized = this.stringifyDeterministic(parsed);
        bodyString = JSON.stringify(normalized);
      } catch {
        // If not valid JSON, use as-is
        bodyString = body;
      }
    } else {
      // Use deterministic stringification
      const normalized = this.stringifyDeterministic(body);
      bodyString = JSON.stringify(normalized);
    }
    
    return `${timestamp}.${bodyString}`;
  }

  /**
   * Deterministic JSON stringification that produces consistent output
   * regardless of key order. Recursively sorts all object keys.
   */
  private stringifyDeterministic(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.stringifyDeterministic(item));
    }
    
    // Sort keys and recursively process nested objects
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = this.stringifyDeterministic(obj[key]);
    }
    
    return sortedObj;
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

