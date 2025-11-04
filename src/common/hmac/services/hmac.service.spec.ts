import { Test, TestingModule } from '@nestjs/testing';
import { HmacService } from './hmac.service';

describe('HmacService', () => {
  let service: HmacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HmacService],
    }).compile();

    service = module.get<HmacService>(HmacService);
  });

  describe('generateSignature', () => {
    it('should generate consistent signatures for same input', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';

      const signature1 = service.generateSignature(payload, secret);
      const signature2 = service.generateSignature(payload, secret);

      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret';

      const signature1 = service.generateSignature('payload1', secret);
      const signature2 = service.generateSignature('payload2', secret);

      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = 'test-payload';

      const signature1 = service.generateSignature(payload, 'secret1');
      const signature2 = service.generateSignature(payload, 'secret2');

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('validateSignature', () => {
    it('should validate correct signature', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';
      const signature = service.generateSignature(payload, secret);

      const isValid = service.validateSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const payload = 'test-payload';
      const secret = 'test-secret';
      const wrongSignature = 'wrong-signature';

      const isValid = service.validateSignature(payload, wrongSignature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = 'test-payload';
      const signature = service.generateSignature(payload, 'secret1');

      const isValid = service.validateSignature(payload, signature, 'secret2');

      expect(isValid).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    it('should validate recent timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const isValid = service.validateTimestamp(timestamp, 300);

      expect(isValid).toBe(true);
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();

      const isValid = service.validateTimestamp(oldTimestamp, 300);

      expect(isValid).toBe(false);
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 600).toString();

      const isValid = service.validateTimestamp(futureTimestamp, 300);

      expect(isValid).toBe(false);
    });
  });

  describe('createPayload', () => {
    it('should create payload from object and timestamp', () => {
      const body = { amount: 1000, currency: 'USD' };
      const timestamp = '1234567890';

      const payload = service.createPayload(body, timestamp);

      expect(payload).toBe('1234567890.{"amount":1000,"currency":"USD"}');
    });

    it('should handle string body', () => {
      const body = 'string-body';
      const timestamp = '1234567890';

      const payload = service.createPayload(body, timestamp);

      expect(payload).toBe('1234567890.string-body');
    });
  });
});

