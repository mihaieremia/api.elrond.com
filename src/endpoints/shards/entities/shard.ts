import { ApiProperty } from '@nestjs/swagger';

export class Shard {
  @ApiProperty()
  shard = 0;

  @ApiProperty()
  validators = 0;

  @ApiProperty()
  activeValidators = 0;
}
