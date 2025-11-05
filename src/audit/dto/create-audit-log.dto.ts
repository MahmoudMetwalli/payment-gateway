import {
  UserType,
  AuditStatus,
  EventSeverity,
} from '../schemas/audit-log.schema';

export class CreateAuditLogDto {
  // User identification (PCI DSS 10.2.1)
  userId: string;
  userName?: string;
  userType: UserType;
  ipAddress: string;
  userAgent?: string;

  // Event details (PCI DSS 10.2.2)
  action: string;
  eventCategory?: string;
  resource: string;
  resourceId?: string;
  method: string;
  endpoint?: string;

  // Success/Failure (PCI DSS 10.2.4)
  status: AuditStatus;
  statusCode?: number;
  errorMessage?: string;

  // Origination (PCI DSS 10.2.5)
  sourceHost?: string;
  sourceDevice?: string;

  // Data access (PCI DSS 10.2.6 & 10.2.7)
  dataAccessed?: string[];
  sensitiveDataAccessed?: boolean;
  cardholderDataAccess?: boolean;
  tokenIds?: string[];

  // Additional context
  requestId?: string;
  sessionId?: string;
  severity?: EventSeverity;
  changes?: {
    before?: any;
    after?: any;
  };
  requestDetails?: Record<string, any>;
  metadata?: Record<string, any>;
}
