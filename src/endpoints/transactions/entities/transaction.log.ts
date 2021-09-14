import { ApiProperty } from '@nestjs/swagger';
import { TransactionLogEvent } from './transaction.log.event';

export class TransactionLog {
  @ApiProperty()
  address = '';

  @ApiProperty()
  events: TransactionLogEvent[] = [];
}
