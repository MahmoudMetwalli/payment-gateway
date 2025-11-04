import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardDto } from 'src/tokenization/dto';

export class CreatePurchaseDto {
  @ApiProperty({
    description: 'Transaction amount in minor units (cents)',
    example: 1000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @ApiPropertyOptional({
    description: 'Existing card token (if already tokenized)',
    example: 'tok_1234567890abcdef',
  })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({
    description: 'Raw card data (will be tokenized)',
    type: CardDto,
  })
  @ValidateNested()
  @Type(() => CardDto)
  @IsOptional()
  cardData?: CardDto;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { orderId: '12345', customerEmail: 'customer@example.com' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

