import { IsString } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  id: string;
  @IsString()
  password: string;
}
