import { IsString, IsEmail, IsEnum, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../schemas/admin.schema';

export class UpdateAdminDto {
  @ApiPropertyOptional({ description: 'Admin username' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'Admin password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ description: 'Admin email' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ enum: AdminRole, description: 'Admin role' })
  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;

  @ApiPropertyOptional({ description: 'Is admin active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

