import { Module } from '@nestjs/common';
import { UnityOfWorkService } from './unity-of-work.service';

@Module({
  providers: [UnityOfWorkService],
  exports: [UnityOfWorkService],
})
export class DatabaseModule {}

