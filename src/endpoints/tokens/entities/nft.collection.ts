import { ApiProperty } from '@nestjs/swagger';

export class NftCollection {
  @ApiProperty()
  collection = '';

  @ApiProperty()
  name = '';

  @ApiProperty()
  ticker = '';

  @ApiProperty()
  issuer = '';

  @ApiProperty()
  timestamp = 0;

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
  canAddSpecialRoles = false;

  @ApiProperty()
  canTransferNFTCreateRole = false;

  @ApiProperty()
  NFTCreateStopped = false;
}
