import { ApiProperty } from '@nestjs/swagger';

export class NetworkConstants {
  @ApiProperty({ description: 'The chain identifier' })
  chainId = '';

  @ApiProperty({ description: 'Gas per data byte' })
  gasPerDataByte = 0;

  @ApiProperty({ description: 'Minimum gas limit' })
  minGasLimit = 0;

  @ApiProperty({ description: 'Minimum gas price' })
  minGasPrice = 0;

  @ApiProperty({ description: 'Minimum transaction version' })
  minTransactionVersion = 0;
}
