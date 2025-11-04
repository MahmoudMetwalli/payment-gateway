import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AuditLog, UserType } from '../schemas/audit-log.schema';

describe('AuditService', () => {
  let service: AuditService;

  const mockAuditLogModel = {
    save: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getModelToken(AuditLog.name),
          useValue: mockAuditLogModel,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('logAction', () => {
    it('should sanitize CVV from request details', async () => {
      const requestDetails = {
        cardData: {
          cardNumber: '4532015112830366',
          cvv: '123',
        },
      };

      // Access private method through any type cast for testing
      const sanitized = (service as any).sanitizeRequestDetails(requestDetails);

      expect(sanitized.cardData.cvv).toBe('[REDACTED]');
    });

    it('should mask card numbers showing only last 4 digits', async () => {
      const requestDetails = {
        cardNumber: '4532015112830366',
      };

      const sanitized = (service as any).sanitizeRequestDetails(requestDetails);

      expect(sanitized.cardNumber).toMatch(/\*+0366$/);
      expect(sanitized.cardNumber).not.toContain('4532');
    });

    it('should redact API secrets and passwords', async () => {
      const requestDetails = {
        apiSecret: 'sk_test_123456',
        password: 'mypassword',
        token: 'some_token',
      };

      const sanitized = (service as any).sanitizeRequestDetails(requestDetails);

      expect(sanitized.apiSecret).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should handle nested objects', async () => {
      const requestDetails = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            cvv: '456',
          },
        },
      };

      const sanitized = (service as any).sanitizeRequestDetails(requestDetails);

      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.credentials.password).toBe('[REDACTED]');
      expect(sanitized.user.credentials.cvv).toBe('[REDACTED]');
    });
  });

  describe('maskCardNumber', () => {
    it('should mask card number correctly', () => {
      const cardNumber = '4532015112830366';

      const masked = (service as any).maskCardNumber(cardNumber);

      expect(masked).toBe('************0366');
      expect(masked.length).toBe(cardNumber.length);
    });

    it('should handle short strings', () => {
      const short = '123';

      const masked = (service as any).maskCardNumber(short);

      expect(masked).toBe('****');
    });
  });
});

