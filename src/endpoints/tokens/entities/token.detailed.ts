import { ApiProperty } from '@nestjs/swagger';
import { Token } from './token';
import { TokenAssets } from './token.assets';

export class TokenDetailed extends Token {
  @ApiProperty()
  canUpgrade = false;

  @ApiProperty()
  canMint = false;

  @ApiProperty()
  canBurn = false;

  @ApiProperty()
  canChangeOwner = false;

  @ApiProperty()
  canPause = false;

  @ApiProperty()
  canFreeze = false;

  @ApiProperty()
  canWipe = false;

  @ApiProperty()
  assets: TokenAssets | undefined = undefined;
}
