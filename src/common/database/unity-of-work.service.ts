import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';

@Injectable()
export class UnityOfWorkService {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  /**
   * Execute operations within a transactional session
   * Commits if all operations succeed, rolls back on error
   */
  async execute<T>(
    operations: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const result = await operations(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

