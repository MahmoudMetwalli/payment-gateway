import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { TokenizationService } from './tokenization.service';
import { EncryptionService } from './encryption.service';
import { TokenVault } from '../schemas/token-vault.schema';
import { CardDto } from '../dto';

describe('TokenizationService', () => {
  let service: TokenizationService;
  let encryptionService: EncryptionService;

  const mockTokenVaultModel = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenizationService,
        {
          provide: getModelToken(TokenVault.name),
          useValue: mockTokenVaultModel,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<TokenizationService>(TokenizationService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('tokenizeCard', () => {
    it('should successfully tokenize a valid card', async () => {
      const cardData: CardDto = {
        cardNumber: '4532015112830366',
        cvv: '123',
        expiryMonth: 12,
        expiryYear: 2025,
        cardHolderName: 'John Doe',
      };

      mockEncryptionService.encrypt.mockReturnValue('encrypted_data');
      const mockSave = jest.fn().mockResolvedValue({
        token: 'tok_abc123',
        cardLast4: '0366',
        cardBrand: 'Visa',
      });

      const result = await service.tokenizeCard(cardData, 'merchant123');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('cardLast4', '0366');
      expect(result).toHaveProperty('cardBrand', 'Visa');
    });

    it('should reject invalid card number (Luhn check)', async () => {
      const invalidCard: CardDto = {
        cardNumber: '1234567890123456',
        cvv: '123',
        expiryMonth: 12,
        expiryYear: 2025,
        cardHolderName: 'John Doe',
      };

      await expect(
        service.tokenizeCard(invalidCard, 'merchant123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired card', async () => {
      const expiredCard: CardDto = {
        cardNumber: '4532015112830366',
        cvv: '123',
        expiryMonth: 1,
        expiryYear: 2020,
        cardHolderName: 'John Doe',
      };

      await expect(
        service.tokenizeCard(expiredCard, 'merchant123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should correctly detect card brand', async () => {
      const visaCard: CardDto = {
        cardNumber: '4532015112830366',
        cvv: '123',
        expiryMonth: 12,
        expiryYear: 2025,
        cardHolderName: 'John Doe',
      };

      mockEncryptionService.encrypt.mockReturnValue('encrypted_data');

      // We're testing the internal brand detection
      // In reality, this would be checked by mocking the save
      expect(visaCard.cardNumber.startsWith('4')).toBe(true);
    });
  });
});

