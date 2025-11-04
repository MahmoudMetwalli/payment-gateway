import { IsString, IsNumber } from 'class-validator';

export class UpdateBalanceDto {
  @IsString()
  id: string;

  @IsNumber()
  amount: number;
}
