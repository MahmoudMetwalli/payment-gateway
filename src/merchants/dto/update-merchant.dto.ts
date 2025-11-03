import {
  IsString,
  IsOptional,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateMerchantDto {
  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  balance?: number;
}
