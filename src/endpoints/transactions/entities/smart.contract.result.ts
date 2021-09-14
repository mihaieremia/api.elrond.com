import { ApiProperty } from '@nestjs/swagger';
import { TransactionLog } from './transaction.log';

export class SmartContractResult {
  @ApiProperty()
  hash = '';

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  gasLimit = 0;

  @ApiProperty()
  gasPrice = 0;

  @ApiProperty()
  value = '';

  @ApiProperty()
  sender = '';

  @ApiProperty()
  receiver = '';

  @ApiProperty()
  relayedValue = '';

  @ApiProperty()
  data = '';

  @ApiProperty()
  prevTxHash = '';

  @ApiProperty()
  originalTxHash = '';

  @ApiProperty()
  callType = '';

  @ApiProperty({ type: TransactionLog })
  logs: TransactionLog | undefined = undefined;

  @ApiProperty()
  returnMessage: string | undefined = undefined;
}
