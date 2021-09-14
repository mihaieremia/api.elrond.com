import { ApiProperty } from '@nestjs/swagger';

export class WaitingList {
  @ApiProperty()
  address = '';

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  rank = 0;

  @ApiProperty()
  value = '';
}
