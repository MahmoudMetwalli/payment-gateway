import { IsString, IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../schemas/admin.schema';

export class CreateAdminDto {
  @ApiProperty({ description: 'Admin username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Admin password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: AdminRole, description: 'Admin role' })
  @IsEnum(AdminRole)
  role: AdminRole;
}

