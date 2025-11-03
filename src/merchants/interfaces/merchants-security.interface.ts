export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface IMerchantSecurityService {
  hashPassword(password: string): Promise<string>;
  comparePassword(
    candidatePassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
  generateApiKey(): string;
  generateApiSecret(): string;
  generateApiCredentials(): ApiCredentials;
}

export const MERCHANTS_SECURITY_SERVICE = 'MERCHANTS_SECURITY_SERVICE';
