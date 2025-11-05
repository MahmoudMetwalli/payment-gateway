import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm: string;
  private readonly encryptionKey: Buffer;
  private readonly ivLength: number;
  private readonly keyLength: number;

  constructor(private configService: ConfigService) {
    // Get algorithm (default: aes-256-gcm)
    this.algorithm = this.configService.get<string>(
      'ENCRYPTION_ALGORITHM',
      'aes-256-gcm',
    );

    // Determine key length based on algorithm
    this.keyLength = this.getKeyLength(this.algorithm);

    // Get encryption key
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key || key.length !== this.keyLength) {
      throw new Error(
        `ENCRYPTION_KEY must be exactly ${this.keyLength} characters for ${this.algorithm}`,
      );
    }
    this.encryptionKey = Buffer.from(key, 'utf-8');

    // Get IV length (default: 16 bytes for GCM)
    this.ivLength = this.configService.get<number>('ENCRYPTION_IV_LENGTH', 16);
  }

  /**
   * Determines the required key length based on the algorithm
   */
  private getKeyLength(algorithm: string): number {
    if (algorithm.includes('256')) return 32; // 256 bits = 32 bytes
    if (algorithm.includes('192')) return 24; // 192 bits = 24 bytes
    if (algorithm.includes('128')) return 16; // 128 bits = 16 bytes
    return 32; // Default to 256-bit
  }

  /**
   * Encrypts data using the configured algorithm
   * Returns: iv:authTag:encryptedData (all in hex) for GCM modes
   * Returns: iv:encryptedData for non-GCM modes
   */
  encrypt(data: string): string {
    try {
      const iv = randomBytes(this.ivLength);
      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Only get auth tag for GCM modes
      const authTag = this.algorithm.includes('gcm')
        ? (cipher as any).getAuthTag()
        : null;

      // Format: iv:authTag:encryptedData for GCM, iv:encryptedData for others
      if (authTag) {
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      } else {
        return `${iv.toString('hex')}:${encrypted}`;
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Encryption failed',
        error.message,
      );
    }
  }

  /**
   * Decrypts data encrypted with the configured algorithm
   * Expects format: iv:authTag:encryptedData for GCM modes
   * Expects format: iv:encryptedData for non-GCM modes
   */
  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      const isGcmMode = this.algorithm.includes('gcm');

      // Validate format based on mode
      if (isGcmMode && parts.length !== 3) {
        throw new Error('Invalid encrypted data format for GCM mode');
      }
      if (!isGcmMode && parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);

      // Set auth tag for GCM modes
      if (isGcmMode) {
        const authTag = Buffer.from(parts[1], 'hex');
        (decipher as any).setAuthTag(authTag);
      }

      const encrypted = isGcmMode ? parts[2] : parts[1];

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new InternalServerErrorException(
        'Decryption failed',
        error.message,
      );
    }
  }

  /**
   * Masks a string showing only the last N characters
   */
  maskString(value: string, visibleChars: number = 4): string {
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }
    const masked = '*'.repeat(value.length - visibleChars);
    return masked + value.slice(-visibleChars);
  }
}
