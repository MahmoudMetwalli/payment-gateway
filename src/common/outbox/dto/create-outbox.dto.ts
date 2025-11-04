import { OutboxEventType } from '../schemas/outbox.schema';

export class CreateOutboxDto {
  aggregateId: string;
  eventType: OutboxEventType;
  payload: Record<string, any>;
}

