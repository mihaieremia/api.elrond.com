import { ApiProperty } from '@nestjs/swagger';

export class Block {
  @ApiProperty()
  hash = '';

  @ApiProperty()
  epoch = 0;

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  prevHash = '';

  @ApiProperty()
  proposer = '';

  @ApiProperty()
  pubKeyBitmap = '';

  @ApiProperty()
  round = 0;

  @ApiProperty()
  shard = 0;

  @ApiProperty()
  size = 0;

  @ApiProperty()
  sizeTxs = 0;

  @ApiProperty()
  stateRootHash = '';

  @ApiProperty()
  timestamp = 0;

  @ApiProperty()
  txCount = 0;
}
