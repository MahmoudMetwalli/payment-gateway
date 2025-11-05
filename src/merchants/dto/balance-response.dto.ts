import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({ example: 1000.5, description: 'Current merchant balance' })
  balance: number;

  @ApiProperty({ example: 'USD', description: 'Currency code' })
  currency?: string;
}
