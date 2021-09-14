import { ApiProperty } from '@nestjs/swagger';

export class MiniBlockDetailed {
  @ApiProperty()
  miniBlockHash = '';

  @ApiProperty()
  receiverBlockHash = '';

  @ApiProperty()
  receiverShard = 0;

  @ApiProperty()
  senderBlockHash = '';

  @ApiProperty()
  senderShard = 0;

  @ApiProperty()
  timestamp = 0;

  @ApiProperty()
  type = '';
}
