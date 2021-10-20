import { ApiProperty } from '@nestjs/swagger';
import { NftMetadata } from './nft.metadata';
import { NftType } from './nft.type';

export class Nft {
  @ApiProperty()
  identifier = '';

  @ApiProperty()
  collection = '';

  @ApiProperty()
  timestamp = 0;

  @ApiProperty()
  attributes = '';

  @ApiProperty()
  nonce = 0;

  @ApiProperty()
  type: NftType = NftType.NonFungibleESDT;

  @ApiProperty()
  name = '';

  @ApiProperty()
  creator = '';

  @ApiProperty()
  royalties = 0;

  @ApiProperty()
  uris: string[] = [];

  @ApiProperty()
  url = '';

  @ApiProperty()
  thumbnailUrl = '';

  @ApiProperty()
  tags: string[] = [];

  @ApiProperty()
  metadata: NftMetadata | undefined = undefined;

  @ApiProperty()
  owner?: string;

  @ApiProperty()
  balance?: string;

  @ApiProperty()
  supply?: string;
}
