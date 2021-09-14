import { ApiProperty } from '@nestjs/swagger';

export class Token {
  @ApiProperty()
  identifier = '';

  @ApiProperty()
  name = '';

  @ApiProperty()
  owner = '';

  @ApiProperty()
  minted = '';

  @ApiProperty()
  burnt = '';

  @ApiProperty()
  decimals = 0;

  @ApiProperty()
  isPaused = false;
}
