import { ApiProperty } from '@nestjs/swagger';

export class TransactionSendResult {
  @ApiProperty()
  receiver = '';

  @ApiProperty()
  receiverShard = 0;

  @ApiProperty()
  sender = '';

  @ApiProperty()
  senderShard = 0;

  @ApiProperty()
  status = '';

  @ApiProperty()
  txHash = '';
}
