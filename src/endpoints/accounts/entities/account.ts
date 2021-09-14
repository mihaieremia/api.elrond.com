import { ApiProperty } from '@nestjs/swagger';

export class Account {
  @ApiProperty({ description: 'The address of the account' })
  address = '';

  @ApiProperty({
    description:
      'The current balance of the account (must be denominated to obtain the real value)',
  })
  balance = '';

  @ApiProperty({ description: 'The current nonce of the account' })
  nonce = '';

  @ApiProperty({ description: 'The shard identifier of the account' })
  shard = 0;
}
