import { Injectable, Logger } from '@nestjs/common';
import { circuitBreaker, ConsecutiveBreaker, handleAll, CircuitBreakerPolicy } from 'cockatiel';

export interface BankTransactionRequest {
  transactionId: string;
  amount: number;
  currency: string;
  token: string;
}

export interface BankResponseDto {
  success: boolean;
  authorizationCode?: string;
  declineReason?: string;
}

@Injectable()
export class AcquiringBankService {
  private readonly logger = new Logger(AcquiringBankService.name);
  private readonly breaker: CircuitBreakerPolicy;

  constructor() {
    // Configure circuit breaker for bank connection
    this.breaker = circuitBreaker(handleAll, {
      halfOpenAfter: 30 * 1000,
      breaker: new ConsecutiveBreaker(5),
    });

    this.breaker.onBreak(() => {
      this.logger.error('Circuit breaker opened - Bank connection issues');
    });

    this.breaker.onReset(() => {
      this.logger.log('Circuit breaker reset - Bank connection restored');
    });

    this.breaker.onHalfOpen(() => {
      this.logger.warn('Circuit breaker half-open - Testing bank connection');
    });
  }

  /**
   * Process transaction with acquiring bank (mocked)
   * Wrapped with circuit breaker for resilience
   */
  async processTransaction(
    request: BankTransactionRequest,
  ): Promise<BankResponseDto> {
    return this.breaker.execute(async () => {
      // Simulate network delay
      await this.delay(Math.random() * 400 + 100);

      // Mock logic: 90% success for amounts < 100000 cents ($1000)
      // 50% success for amounts >= 100000 cents
      const successRate = request.amount < 100000 ? 0.9 : 0.5;
      const isSuccess = Math.random() < successRate;

      if (isSuccess) {
        const authCode = this.generateAuthCode();
        this.logger.log(
          `Transaction ${request.transactionId} authorized: ${authCode}`,
        );
        return {
          success: true,
          authorizationCode: authCode,
        };
      } else {
        const declineReasons = [
          'Insufficient funds',
          'Invalid card',
          'Suspected fraud',
          'Card expired',
          'Exceeded limit',
        ];
        const reason =
          declineReasons[Math.floor(Math.random() * declineReasons.length)];
        this.logger.warn(
          `Transaction ${request.transactionId} declined: ${reason}`,
        );
        return {
          success: false,
          declineReason: reason,
        };
      }
    });
  }

  /**
   * Process refund with acquiring bank (mocked)
   */
  async processRefund(
    originalTransactionId: string,
    amount: number,
  ): Promise<BankResponseDto> {
    return this.breaker.execute(async () => {
      await this.delay(Math.random() * 300 + 100);

      // Refunds are usually successful
      const isSuccess = Math.random() < 0.95;

      if (isSuccess) {
        const authCode = this.generateAuthCode();
        this.logger.log(`Refund for ${originalTransactionId} approved: ${authCode}`);
        return {
          success: true,
          authorizationCode: authCode,
        };
      } else {
        this.logger.warn(`Refund for ${originalTransactionId} failed`);
        return {
          success: false,
          declineReason: 'Refund processing failed',
        };
      }
    });
  }

  /**
   * Process chargeback with acquiring bank (mocked)
   */
  async processChargeback(
    originalTransactionId: string,
    reason: string,
  ): Promise<BankResponseDto> {
    return this.breaker.execute(async () => {
      await this.delay(Math.random() * 500 + 200);

      // Chargebacks are usually accepted
      const authCode = this.generateAuthCode();
      this.logger.log(
        `Chargeback for ${originalTransactionId} accepted: ${reason}`,
      );
      return {
        success: true,
        authorizationCode: authCode,
      };
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateAuthCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AUTH-${timestamp}-${random}`;
  }
}

