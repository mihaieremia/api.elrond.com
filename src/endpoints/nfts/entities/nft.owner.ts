import { ApiProperty } from '@nestjs/swagger';

export class NftOwner {
  @ApiProperty()
  address = '';

  @ApiProperty()
  balance = '';
}
