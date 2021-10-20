import { ApiProperty } from '@nestjs/swagger';

export class Transaction {
  @ApiProperty()
  txHash = '';

  @ApiProperty()
  gasLimit = 0;

  @ApiProperty()
  gasPrice = 0;

  @ApiProperty()
  gasUsed = 0;

  @ApiProperty()
  miniBlockHash = '';

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  receiver = '';

  @ApiProperty()
  receiverShard = 0;

  @ApiProperty()
  round = 0;

  @ApiProperty()
  sender = '';

  @ApiProperty()
  senderShard = 0;

  @ApiProperty()
  signature = '';

  @ApiProperty()
  status = '';

  @ApiProperty()
  value = '';

  @ApiProperty()
  fee = '';

  @ApiProperty()
  timestamp = 0;

  @ApiProperty()
  data = '';

  @ApiProperty()
  tokenIdentifier?: string;

  @ApiProperty()
  tokenValue?: string;

  getDate(): Date | undefined {
    if (this.timestamp) {
      return new Date(this.timestamp * 1000);
    }

    return undefined;
  }
}
