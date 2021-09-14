import { ApiProperty } from '@nestjs/swagger';
import { NodesInfos } from './nodes.infos';

export class Provider extends NodesInfos {
  @ApiProperty()
  provider = '';

  @ApiProperty()
  owner: string | null = null;

  @ApiProperty()
  featured = false;

  @ApiProperty()
  serviceFee = 0;

  @ApiProperty()
  delegationCap = '';

  @ApiProperty()
  apr = 0;

  @ApiProperty()
  numUsers = 0;

  @ApiProperty()
  cumulatedRewards: string | null = null;

  @ApiProperty()
  identity: string | undefined = undefined;
}
