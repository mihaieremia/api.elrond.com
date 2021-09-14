import { ApiProperty } from '@nestjs/swagger';

export class TransactionLogEvent {
  @ApiProperty()
  address = '';

  @ApiProperty()
  identifier = '';

  @ApiProperty()
  topics: string[] = [];

  @ApiProperty()
  data = '';
}
