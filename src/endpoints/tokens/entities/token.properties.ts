import { ApiProperty } from "@nestjs/swagger";
import { NftType } from "../../nfts/entities/nft.type";

export class TokenProperties {
  @ApiProperty()
  token = '';

  @ApiProperty()
  name = '';

  @ApiProperty()
  type: NftType = NftType.NonFungibleESDT;

  @ApiProperty()
  owner = '';

  @ApiProperty()
  minted = '';

  @ApiProperty()
  burnt = '';

  @ApiProperty()
  wiped = '';

  @ApiProperty()
  decimals = 0;

  @ApiProperty()
  isPaused = false;

  @ApiProperty()
  tags: string[] = [];

  @ApiProperty()
  royalties = 0;

  @ApiProperty()
  uris: string[] = [];

  @ApiProperty()
  url = '';

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
