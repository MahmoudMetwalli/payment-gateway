import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsNumber()
  @Min(0)
  balance: number;
}
