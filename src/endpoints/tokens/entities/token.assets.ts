import { ApiProperty } from '@nestjs/swagger';
import { TokenAssetStatus } from './token.asset.status';

export class TokenAssets {
  @ApiProperty()
  website = '';

  @ApiProperty()
  description = '';

  @ApiProperty()
  status: TokenAssetStatus = TokenAssetStatus.inactive;

  @ApiProperty()
  pngUrl = '';

  @ApiProperty()
  svgUrl = '';
}
