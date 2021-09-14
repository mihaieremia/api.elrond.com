import { ApiProperty } from '@nestjs/swagger';

export class TransactionCreate {
  @ApiProperty()
  chainId = '';

  @ApiProperty()
  data = '';

  @ApiProperty()
  gasLimit = 0;

  @ApiProperty()
  gasPrice = 0;

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  receiver = '';

  @ApiProperty()
  sender = '';

  @ApiProperty()
  signature = '';

  @ApiProperty()
  value = '';

  @ApiProperty()
  version = 0;
}
