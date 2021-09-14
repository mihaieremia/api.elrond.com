import { ApiProperty } from '@nestjs/swagger';

export class Economics {
  @ApiProperty()
  totalSupply = 0;

  @ApiProperty()
  circulatingSupply = 0;

  @ApiProperty()
  staked = 0;

  @ApiProperty()
  price: number | undefined = undefined;

  @ApiProperty()
  marketCap: number | undefined = undefined;

  @ApiProperty()
  apr = 0;

  @ApiProperty()
  topUpApr = 0;

  @ApiProperty()
  baseApr = 0;
}
