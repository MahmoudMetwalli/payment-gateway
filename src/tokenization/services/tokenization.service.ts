import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { TokenVault } from '../schemas/token-vault.schema';
import { EncryptionService } from './encryption.service';
import { CardDto, TokenDto, DecryptedCardDto } from '../dto';

@Injectable()
export class TokenizationService {
  constructor(
    @InjectModel(TokenVault.name)
    private tokenVaultModel: Model<TokenVault>,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Tokenize card data and store in vault
   */
  async tokenizeCard(
    cardData: CardDto,
    merchantId: string,
  ): Promise<TokenDto> {
    // Validate card number using Luhn algorithm
    if (!this.validateLuhn(cardData.cardNumber)) {
      throw new BadRequestException('Invalid card number');
    }

    // Validate expiry date
    this.validateExpiryDate(cardData.expiryMonth, cardData.expiryYear);

    // Detect card brand
    const cardBrand = this.detectCardBrand(cardData.cardNumber);

    // Encrypt card data
    const encryptedCardData = this.encryptionService.encrypt(
      JSON.stringify({
        cardNumber: cardData.cardNumber,
        cvv: cardData.cvv,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cardHolderName: cardData.cardHolderName,
      }),
    );

    // Generate unique token
    const token = `tok_${randomBytes(32).toString('base64url')}`;

    // Store in vault
    const vaultEntry = new this.tokenVaultModel({
      token,
      encryptedCardData,
      cardLast4: cardData.cardNumber.slice(-4),
      cardBrand,
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      merchantId: new Types.ObjectId(merchantId),
    });

    await vaultEntry.save();

    return {
      token,
      cardLast4: cardData.cardNumber.slice(-4),
      cardBrand,
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
    };
  }

  /**
   * Retrieve and decrypt card data from token
   * Verifies merchantId ownership
   */
  async detokenize(
    token: string,
    merchantId: string,
  ): Promise<DecryptedCardDto> {
    const vaultEntry = await this.tokenVaultModel.findOne({
      token,
      merchantId: new Types.ObjectId(merchantId),
    });

    if (!vaultEntry) {
      throw new NotFoundException('Token not found or unauthorized');
    }

    // Decrypt card data
    const decryptedData = this.encryptionService.decrypt(
      vaultEntry.encryptedCardData,
    );
    const cardData = JSON.parse(decryptedData);

    return {
      cardNumber: cardData.cardNumber,
      cvv: cardData.cvv,
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      cardHolderName: cardData.cardHolderName,
    };
  }

  /**
   * Get token info without decrypting sensitive data
   */
  async getTokenInfo(token: string, merchantId: string): Promise<TokenDto> {
    const vaultEntry = await this.tokenVaultModel.findOne({
      token,
      merchantId: new Types.ObjectId(merchantId),
    });

    if (!vaultEntry) {
      throw new NotFoundException('Token not found or unauthorized');
    }

    return {
      token: vaultEntry.token,
      cardLast4: vaultEntry.cardLast4,
      cardBrand: vaultEntry.cardBrand,
      expiryMonth: vaultEntry.expiryMonth,
      expiryYear: vaultEntry.expiryYear,
    };
  }

  /**
   * Validate card number using Luhn algorithm
   */
  private validateLuhn(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;

    // Loop through values starting from the rightmost digit
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Detect card brand from card number
   */
  private detectCardBrand(cardNumber: string): string {
    const patterns = {
      Visa: /^4/,
      Mastercard: /^5[1-5]/,
      'American Express': /^3[47]/,
      Discover: /^6(?:011|5)/,
      'Diners Club': /^3(?:0[0-5]|[68])/,
      JCB: /^35/,
    };

    for (const [brand, pattern] of Object.entries(patterns)) {
      if (pattern.test(cardNumber)) {
        return brand;
      }
    }

    return 'Unknown';
  }

  /**
   * Validate expiry date is in the future
   */
  private validateExpiryDate(month: number, year: number): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      throw new BadRequestException('Card has expired');
    }
  }
}

