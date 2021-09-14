import { ApiProperty } from '@nestjs/swagger';
import { Account } from './account';

export class AccountDetailed extends Account {
  @ApiProperty({ description: 'The source code in hex format' })
  code = '';

  @ApiProperty({ description: 'The hash of the source code' })
  codeHash = '';

  @ApiProperty({ description: 'The hash of the root node' })
  rootHash = '';

  @ApiProperty({
    description: 'The number of transactions performed on this account',
  })
  txCount = 0;

  @ApiProperty()
  username = '';
}
