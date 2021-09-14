import { BinaryUtils } from 'src/utils/binary.utils';

export class ShardTransaction {
  value = '';
  data: string | undefined;
  hash = '';
  sender = '';
  receiver = '';
  status = '';
  sourceShard = 0;
  destinationShard = 0;
  nonce = 0;

  private dataDecoded: string | undefined;
  private getDataDecoded(): string | undefined {
    if (!this.dataDecoded) {
      if (this.data) {
        this.dataDecoded = BinaryUtils.base64Decode(this.data);
      }
    }

    return this.dataDecoded;
  }

  private dataFunctionName: string | undefined;
  public getDataFunctionName(): string | undefined {
    if (!this.dataFunctionName) {
      const decoded = this.getDataDecoded();
      if (decoded) {
        this.dataFunctionName = decoded.split('@')[0];
      }
    }

    return this.dataFunctionName;
  }

  private dataArgs: string[] | undefined;
  public getDataArgs(): string[] | undefined {
    if (!this.dataArgs) {
      const decoded = this.getDataDecoded();
      if (decoded) {
        this.dataArgs = decoded.split('@').splice(1);
      }
    }

    return this.dataArgs;
  }
}
