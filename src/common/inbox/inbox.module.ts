import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Inbox, InboxSchema } from './schemas/inbox.schema';
import { InboxService } from './services/inbox.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Inbox.name, schema: InboxSchema }]),
  ],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}

