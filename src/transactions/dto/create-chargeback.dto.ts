import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChargebackDto {
  @ApiProperty({
    description: 'Reason for chargeback',
    example: 'Fraudulent transaction',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'External dispute ID',
    example: 'DISP-12345',
  })
  @IsString()
  @IsOptional()
  disputeId?: string;
}
