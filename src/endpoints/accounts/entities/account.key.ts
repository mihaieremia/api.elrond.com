import { ApiProperty } from '@nestjs/swagger';

export class AccountKey {
  @ApiProperty()
  blsKey = '';

  @ApiProperty()
  stake = '';

  @ApiProperty()
  status = '';

  @ApiProperty()
  rewardAddress = '';
}
