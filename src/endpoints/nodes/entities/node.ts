import { ApiProperty } from '@nestjs/swagger';
import { NodeStatus } from './node.status';
import { NodeType } from './node.type';

export class Node {
  @ApiProperty()
  bls = '';

  @ApiProperty()
  name = '';

  @ApiProperty()
  version = '';

  @ApiProperty()
  rating = 0;

  @ApiProperty()
  tempRating = 0;

  @ApiProperty()
  ratingModifier = 0;

  @ApiProperty()
  uptimeSec = 0;

  @ApiProperty()
  downtimeSec = 0;

  @ApiProperty()
  shard: number | undefined = undefined;

  @ApiProperty()
  type: NodeType | undefined = undefined;

  @ApiProperty()
  status: NodeStatus | undefined = undefined;

  @ApiProperty()
  online = false;

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  instances = 0;

  @ApiProperty()
  uptime = 0;

  @ApiProperty()
  downtime = 0;

  @ApiProperty()
  owner = '';

  @ApiProperty()
  identity: string | undefined = undefined;

  @ApiProperty()
  provider = '';

  @ApiProperty()
  issues: string[] = [];

  @ApiProperty()
  stake = '';

  @ApiProperty()
  topUp = '';

  @ApiProperty()
  locked = '';

  @ApiProperty()
  leaderFailure = 0;

  @ApiProperty()
  leaderSuccess = 0;

  @ApiProperty()
  validatorFailure = 0;

  @ApiProperty()
  validatorIgnoredSignatures = 0;

  @ApiProperty()
  validatorSuccess = 0;

  @ApiProperty()
  position = 0;
}
