import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithdrawalDto {
  @ApiProperty({ description: 'Amount to withdraw', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class WithdrawalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  bankAccountLast4: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  processedAt?: Date;
}

