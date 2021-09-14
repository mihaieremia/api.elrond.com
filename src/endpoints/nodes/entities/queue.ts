import { ApiProperty } from '@nestjs/swagger';

export class Queue {
  @ApiProperty()
  bls = '';

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  rewardsAddress = '';

  @ApiProperty()
  position = 0;
}
