import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
