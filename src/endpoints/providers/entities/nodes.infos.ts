import { ApiProperty } from '@nestjs/swagger';

export class NodesInfos {
  @ApiProperty()
  numNodes = 0;

  @ApiProperty()
  stake = '';

  @ApiProperty()
  topUp = '';

  @ApiProperty()
  locked = '';
}
