import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { IMerchantSecurityService, ApiCredentials } from '../interfaces';

@Injectable()
export class MerchantSecurityService implements IMerchantSecurityService {
  private readonly saltRounds = 10;

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.saltRounds);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(
    candidatePassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(candidatePassword, hashedPassword);
  }

  generateApiKey(): string {
    return `pk_${randomBytes(32).toString('base64url')}`;
  }

  generateApiSecret(): string {
    return `sk_${randomBytes(64).toString('base64url')}`;
  }

  generateApiCredentials(): ApiCredentials {
    return {
      apiKey: this.generateApiKey(),
      apiSecret: this.generateApiSecret(),
    };
  }
}
