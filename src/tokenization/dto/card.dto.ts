import { IsString, IsNotEmpty, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CardDto {
  @ApiProperty({
    description: 'Credit card number (PAN)',
    example: '4532015112830366',
    minLength: 13,
    maxLength: 19,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{13,19}$/, {
    message: 'Card number must be between 13 and 19 digits',
  })
  cardNumber: string;

  @ApiProperty({
    description: 'Card CVV/CVC code',
    example: '123',
    minLength: 3,
    maxLength: 4,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{3,4}$/, {
    message: 'CVV must be 3 or 4 digits',
  })
  cvv: string;

  @ApiProperty({
    description: 'Card expiry month',
    example: 12,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @ApiProperty({
    description: 'Card expiry year',
    example: 2025,
    minimum: 2024,
    maximum: 2099,
  })
  @IsInt()
  @Min(2024)
  @Max(2099)
  expiryYear: number;

  @ApiProperty({
    description: 'Name on the card',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  cardHolderName: string;
}

