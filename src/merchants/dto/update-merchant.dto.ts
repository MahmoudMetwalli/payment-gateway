import {
  IsString,
  IsOptional,
  MinLength,
  IsArray,
  IsUrl,
} from 'class-validator';

export class UpdateMerchantDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsArray()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  webhook?: string[];
}
