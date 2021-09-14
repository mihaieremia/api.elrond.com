import { ApiProperty } from '@nestjs/swagger';

export class TransactionReceipt {
  @ApiProperty()
  value = '';

  @ApiProperty()
  sender = '';

  @ApiProperty()
  data = '';
}
