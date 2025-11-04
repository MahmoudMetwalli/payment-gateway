import { IsString } from 'class-validator';

export class AuthDto {
  @IsString()
  userName: string;
  @IsString()
  password: string;
}
