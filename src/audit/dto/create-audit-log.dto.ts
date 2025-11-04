import { UserType } from '../schemas/audit-log.schema';

export class CreateAuditLogDto {
  userId: string;
  userType: UserType;
  action: string;
  resource: string;
  resourceId?: string;
  requestDetails?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  statusCode?: number;
  errorMessage?: string;
}

