import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRefundDto {
  @ApiProperty({
    description: 'Refund amount (must be <= remaining refundable amount)',
    example: 500,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Customer requested refund',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

