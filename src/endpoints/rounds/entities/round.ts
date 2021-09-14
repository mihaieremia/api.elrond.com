import { ApiProperty } from '@nestjs/swagger';

export class Round {
  @ApiProperty()
  blockWasProposed = false;

  @ApiProperty()
  round = 0;

  @ApiProperty()
  shard = 0;

  @ApiProperty()
  timestamp = 0;
}
