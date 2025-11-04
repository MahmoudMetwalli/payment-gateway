import { ApiProperty } from '@nestjs/swagger';

export class TokenDto {
  @ApiProperty({
    description: 'Unique token representing the card',
    example: 'tok_1234567890abcdef',
  })
  token: string;

  @ApiProperty({
    description: 'Last 4 digits of the card',
    example: '0366',
  })
  cardLast4: string;

  @ApiProperty({
    description: 'Card brand (Visa, Mastercard, etc.)',
    example: 'Visa',
  })
  cardBrand: string;

  @ApiProperty({
    description: 'Card expiry month',
    example: 12,
  })
  expiryMonth: number;

  @ApiProperty({
    description: 'Card expiry year',
    example: 2025,
  })
  expiryYear: number;
}

export class DecryptedCardDto {
  cardNumber: string;
  cvv: string;
  expiryMonth: number;
  expiryYear: number;
  cardHolderName: string;
}

