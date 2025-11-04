import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../schemas/admin.schema';

export class AdminResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: AdminRole })
  role: AdminRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

