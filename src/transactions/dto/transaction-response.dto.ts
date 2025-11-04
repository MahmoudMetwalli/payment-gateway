import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../schemas/transaction.schema';

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Merchant ID' })
  merchantId: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Transaction status', enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ description: 'Transaction type', enum: TransactionType })
  type: TransactionType;

  @ApiPropertyOptional({ description: 'Last 4 digits of card' })
  cardLast4?: string;

  @ApiPropertyOptional({ description: 'Card brand' })
  cardBrand?: string;

  @ApiPropertyOptional({ description: 'Authorization code' })
  authorizationCode?: string;

  @ApiPropertyOptional({ description: 'Failure reason' })
  failureReason?: string;

  @ApiPropertyOptional({ description: 'Original transaction ID for refunds/chargebacks' })
  originalTransactionId?: string;

  @ApiPropertyOptional({ description: 'Total refunded amount' })
  refundedAmount?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

