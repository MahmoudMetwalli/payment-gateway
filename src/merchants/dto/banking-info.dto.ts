import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BankingInfoDto {
  @ApiProperty({ description: 'Bank account number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{8,17}$/, {
    message: 'Bank account number must be between 8 and 17 digits',
  })
  bankAccountNumber: string;

  @ApiProperty({ description: 'Bank routing number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{9}$/, {
    message: 'Bank routing number must be 9 digits',
  })
  bankRoutingNumber: string;

  @ApiProperty({ description: 'Account holder name' })
  @IsString()
  @IsNotEmpty()
  bankAccountHolderName: string;

  @ApiProperty({ description: 'Bank name' })
  @IsString()
  @IsNotEmpty()
  bankName: string;
}

export class BankingInfoResponseDto {
  @ApiProperty({ description: 'Masked bank account number' })
  bankAccountNumber: string;

  @ApiProperty({ description: 'Bank routing number' })
  bankRoutingNumber: string;

  @ApiProperty({ description: 'Account holder name' })
  bankAccountHolderName: string;

  @ApiProperty({ description: 'Bank name' })
  bankName: string;
}

