import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../schemas/admin.schema';

export const Roles = (...roles: AdminRole[]) => SetMetadata('roles', roles);

