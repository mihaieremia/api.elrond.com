import { Injectable, Logger } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { ApiConfigService } from 'src/common/api.config.service';
import { CachingService } from 'src/common/caching.service';
import { DataApiService } from 'src/common/data.api.service';
import { DataQuoteType } from 'src/common/entities/data.quote.type';
import { AbstractQuery } from 'src/common/entities/elastic/abstract.query';
import { ElasticPagination } from 'src/common/entities/elastic/elastic.pagination';
import { ElasticQuery } from 'src/common/entities/elastic/elastic.query';
import { ElasticSortOrder } from 'src/common/entities/elastic/elastic.sort.order';
import { ElasticSortProperty } from 'src/common/entities/elastic/elastic.sort.property';
import { QueryConditionOptions } from 'src/common/entities/elastic/query.condition.options';
import { QueryType } from 'src/common/entities/elastic/query.type';
import { GatewayService } from 'src/common/gateway.service';
import { AddressUtils } from 'src/utils/address.utils';
import { ApiUtils } from 'src/utils/api.utils';
import { BinaryUtils } from 'src/utils/binary.utils';
import { Constants } from 'src/utils/constants';
import { NumberUtils } from 'src/utils/number.utils';
import { ElasticService } from '../../common/elastic.service';
import { SmartContractResult } from './entities/smart.contract.result';
import { TransactionCreate } from './entities/transaction.create';
import { TransactionDetailed } from './entities/transaction.detailed';
import { TransactionFilter } from './entities/transaction.filter';
import {
  TransactionHistory,
  TransactionLabeled,
} from './entities/transaction.labels';
import { TransactionLog } from './entities/transaction.log';
import { TransactionLogEvent } from './entities/transaction.log.event';
import { TransactionLogEventIdentifier } from './entities/transaction.log.event.identifier';
import { TransactionOperation } from './entities/transaction.operation';
import { TransactionReceipt } from './entities/transaction.receipt';
import { TransactionSendResult } from './entities/transaction.send.result';
import {
  TransactionType,
  TransactionPoint,
  TransactionStatus,
} from './entities/transaction.status';
import { TransactionOperationType } from './entities/transaction.operation.type';
import { TransactionOperationAction } from './entities/transaction.operation.action';
import { removeDuplicate } from 'src/utils/trust.utils';

@Injectable()
export class TransactionService {
  private readonly logger: Logger;

  constructor(
    private readonly elasticService: ElasticService,
    private readonly cachingService: CachingService,
    private readonly gatewayService: GatewayService,
    private readonly apiConfigService: ApiConfigService,
    private readonly dataApiService: DataApiService,
  ) {
    this.logger = new Logger(TransactionService.name);
  }

  private buildTransactionFilterQuery(
    filter: TransactionFilter,
  ): AbstractQuery[] {
    const queries: AbstractQuery[] = [];

    if (filter.sender) {
      queries.push(QueryType.Match('sender', filter.sender));
    }

    if (filter.receiver) {
      queries.push(QueryType.Match('receiver', filter.receiver));
    }

    if (filter.senderShard) {
      queries.push(QueryType.Match('senderShard', filter.senderShard));
    }

    if (filter.receiverShard) {
      queries.push(QueryType.Match('receiverShard', filter.receiverShard));
    }

    if (filter.miniBlockHash) {
      queries.push(QueryType.Match('miniBlockHash', filter.miniBlockHash));
    }

    if (filter.status) {
      queries.push(QueryType.Match('status', filter.status));
    }

    if (filter.search) {
      queries.push(QueryType.Wildcard('data', `*${filter.search}*`));
    }

    return queries;
  }

  async getTransactionCount(filter: TransactionFilter): Promise<number> {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.condition[
      filter.condition ?? QueryConditionOptions.must
    ] = this.buildTransactionFilterQuery(filter);

    if (filter.before || filter.after) {
      elasticQueryAdapter.filter = [
        QueryType.Range('timestamp', {
          before: filter.before,
          after: filter.after,
        }),
      ];
    }

    return await this.elasticService.getCount(
      'transactions',
      elasticQueryAdapter,
    );
  }

  async getFullAccountHistory(filter: TransactionFilter): Promise<any> {
    const getSendTransactions = await this.getTransactions({
      ...filter,
      status: TransactionStatus.success,
    });
    const getReceiveTransactions = await this.getTransactions({
      ...filter,
      status: TransactionStatus.success,
    });
    const transactions: TransactionHistory[] = [
      ...getSendTransactions,
      ...getReceiveTransactions,
    ];
    transactions.sort(function (
      a: { timestamp: number },
      b: { timestamp: number },
    ) {
      return a.timestamp - b.timestamp;
    });
    removeDuplicate(transactions);
    return transactions;
  }
  async getTransactions(
    filter: TransactionFilter,
  ): Promise<TransactionLabeled[]> {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();

    const { from, size } = filter;
    const pagination: ElasticPagination = {
      from,
      size,
    };
    elasticQueryAdapter.pagination = pagination;
    elasticQueryAdapter.condition[
      filter.condition ?? QueryConditionOptions.must
    ] = this.buildTransactionFilterQuery(filter);

    const timestamp: ElasticSortProperty = {
      name: 'timestamp',
      order: ElasticSortOrder.descending,
    };
    const nonce: ElasticSortProperty = {
      name: 'nonce',
      order: ElasticSortOrder.descending,
    };
    elasticQueryAdapter.sort = [timestamp, nonce];

    if (filter.before || filter.after) {
      elasticQueryAdapter.filter = [
        QueryType.Range('timestamp', {
          before: filter.before,
          after: filter.after,
        }),
      ];
    }

    const transactions = await this.elasticService.getList(
      'transactions',
      'txHash',
      elasticQueryAdapter,
    );

    return transactions.map((tx) => {
      tx = ApiUtils.mergeObjects(new TransactionHistory(), tx);
      tx.value = NumberUtils.denominateFloat(tx.value);
      if (!tx.fee.includes('-')) {
        tx.fee = NumberUtils.denominateFloat(tx.fee);
      } else {
        tx.fee = `${'-'}${NumberUtils.denominateFloat(
          Math.abs(parseFloat(tx.fee)).toString(),
        )}`;
      }
      if (tx.data !== null) {
        tx.data = Buffer.from(tx.data, 'base64').toString();
        if (tx.data.includes('@')) {
          const values = tx.data.split('@');
          tx.method = values[0];
          if (
            values[0] == 'unDelegate' ||
            (values[0] == 'unStake' &&
              tx.receiver ===
                'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt')
          ) {
            values[1] = new BigNumber(values[1], 16).toString(10);
            values[1] = NumberUtils.denominateFloat(values[1]);
            tx.value = values[1];
            tx.data = values.join('@');
          }
          if (
            values[0] == 'unStakeTokens' &&
            tx.receiver ===
              'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
          ) {
            values[1] = new BigNumber(values[1], 16).toString(10);
            values[1] = NumberUtils.denominateFloat(values[1]);
            tx.value = values[1];
            tx.data = values.join('@');
          }
        }
      }
      if (tx.scResults !== null) {
        for (let index = 0; index < tx.scResults.length; index++) {
          const scResult = tx.scResults[index];
          if (tx.scResults[index].value.includes('-')) {
            tx.scResults[index].value = `${'-'}${NumberUtils.denominateFloat(
              Math.abs(parseFloat(tx.scResults[index].value)).toString(),
            )}`;
          } else {
            tx.scResults[index].value = NumberUtils.denominateFloat(
              tx.scResults[index].value,
            );
          }
          if (
            scResult.data &&
            scResult.data !== '' &&
            scResult.data !== '@ok'
          ) {
            tx.scResults[index].data = Buffer.from(
              tx.scResults[index].data,
              'base64',
            ).toString();
            const data_list = tx.scResults[index].data.split('@');
            const data_list_hex: string[] = [];
            if (data_list.length > 1) {
              data_list.forEach((info: any, kIndex: number) => {
                const command = tx.data.toString().split('@');
                if (
                  (command[0].localeCompare('createNewDelegationContract') ==
                    0 ||
                    command[0].localeCompare(
                      'makeNewContractFromValidatorData',
                    ) == 0) &&
                  info.includes('000000') &&
                  kIndex === 2
                ) {
                  console.log(command[0]);
                  data_list_hex.push(AddressUtils.bech32Encode(info));
                } else {
                  const val = Buffer.from(info, 'hex').toString();
                  data_list_hex.push(val);
                }
              });
            } else {
              if (
                scResult.data.includes('unbond') ||
                scResult.data.includes('claim') ||
                tx.data === 'unBondTokens'
              ) {
                tx.value = scResult.value;
              }
            }
            tx.scResults[index].data = data_list_hex.join('@');
          } else {
            if (
              tx.data === 'withdraw' ||
              tx.data === 'reDelegateRewards' ||
              tx.data === 'claimRewards' ||
              tx.method === 'unBond' ||
              tx.data === 'unBondTokens'
            ) {
              if (parseFloat(scResult.value) > 0) {
                tx.value = scResult.value;
              }
            }
          }
        }
      }
      if (AddressUtils.isSmartContractAddress(tx.receiver)) {
        tx.type = TransactionType.functionCall;
        tx.points = TransactionPoint.scCall;
        if (
          tx.receiver ===
          'erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu'
        ) {
          tx.points = TransactionPoint.contractDeployment;
        }
        if (tx.data && !tx.data.includes('@')) {
          tx.method = tx.data;
        }
      } else {
        if (tx.sender === tx.receiver) {
          tx.type = TransactionType.self;
          tx.points = TransactionPoint.receiver;
        } else if (tx.sender === filter.sender && tx.sender !== tx.receiver) {
          tx.type = TransactionType.transfer;
          tx.points = TransactionPoint.transfer;
        } else {
          tx.type = TransactionType.receiver;
          tx.points = TransactionPoint.receiver;
        }
      }
      return tx;
    });
  }

  async getTransaction(txHash: string): Promise<TransactionDetailed | null> {
    let transaction = await this.tryGetTransactionFromElastic(txHash);

    if (transaction === null) {
      transaction = await this.tryGetTransactionFromGateway(txHash);
    }

    if (transaction !== null) {
      transaction.price = await this.getTransactionPrice(transaction);
    }

    return transaction;
  }

  public async getTransactionPrice(
    transaction: TransactionDetailed,
  ): Promise<number | undefined> {
    const dataUrl = this.apiConfigService.getDataUrl();
    if (!dataUrl) {
      return undefined;
    }
    if (transaction === null) {
      return undefined;
    }

    const transactionDate = transaction.getDate();
    if (!transactionDate) {
      return undefined;
    }

    let price = await this.getTransactionPriceForDate(transactionDate);
    if (price) {
      price = Number(price).toRounded(2);
    }

    return price;
  }

  private async getTransactionPriceForDate(
    date: Date,
  ): Promise<number | undefined> {
    if (date.isToday()) {
      return await this.getTransactionPriceToday();
    }

    return await this.getTransactionPriceHistorical(date);
  }

  private async getTransactionPriceToday(): Promise<number | undefined> {
    return await this.cachingService.getOrSetCache(
      'currentPrice',
      async () =>
        await this.dataApiService.getQuotesHistoricalLatest(
          DataQuoteType.price,
        ),
      Constants.oneHour(),
    );
  }

  private async getTransactionPriceHistorical(
    date: Date,
  ): Promise<number | undefined> {
    return await this.cachingService.getOrSetCache(
      `price:${date.toISODateString()}`,
      async () =>
        await this.dataApiService.getQuotesHistoricalTimestamp(
          DataQuoteType.price,
          date.getTime() / 1000,
        ),
      Constants.oneDay() * 7,
    );
  }

  private async tryGetTransactionFromElasticBySenderAndNonce(
    sender: string,
    nonce: number,
  ): Promise<TransactionDetailed | undefined> {
    const query: ElasticQuery = new ElasticQuery();
    query.pagination = { from: 0, size: 1 };

    query.condition.must = [
      QueryType.Match('sender', sender),
      QueryType.Match('nonce', nonce),
    ];

    const transactions = await this.elasticService.getList(
      'transactions',
      'txHash',
      query,
    );

    return transactions.firstOrUndefined();
  }

  async tryGetTransactionFromElastic(
    txHash: string,
  ): Promise<TransactionDetailed | null> {
    try {
      const result = await this.elasticService.getItem(
        'transactions',
        'txHash',
        txHash,
      );

      const transactionDetailed: TransactionDetailed = ApiUtils.mergeObjects(
        new TransactionDetailed(),
        result,
      );

      const hashes: string[] = [];
      hashes.push(txHash);

      if (!this.apiConfigService.getUseLegacyElastic()) {
        const elasticQueryAdapterSc: ElasticQuery = new ElasticQuery();
        elasticQueryAdapterSc.pagination = { from: 0, size: 100 };

        const timestamp: ElasticSortProperty = {
          name: 'timestamp',
          order: ElasticSortOrder.ascending,
        };
        elasticQueryAdapterSc.sort = [timestamp];

        const originalTxHashQuery = QueryType.Match('originalTxHash', txHash);
        elasticQueryAdapterSc.condition.must = [originalTxHashQuery];

        if (result.hasScResults === true) {
          const scResults = await this.elasticService.getList(
            'scresults',
            'scHash',
            elasticQueryAdapterSc,
          );
          for (const scResult of scResults) {
            scResult.hash = scResult.scHash;
            hashes.push(scResult.hash);

            delete scResult.scHash;
          }

          transactionDetailed.scResults = scResults.map((scResult) =>
            ApiUtils.mergeObjects(new SmartContractResult(), scResult),
          );
        }

        const elasticQueryAdapterReceipts: ElasticQuery = new ElasticQuery();
        elasticQueryAdapterReceipts.pagination = { from: 0, size: 1 };

        const receiptHashQuery = QueryType.Match('receiptHash', txHash);
        elasticQueryAdapterReceipts.condition.must = [receiptHashQuery];

        const receipts = await this.elasticService.getList(
          'receipts',
          'receiptHash',
          elasticQueryAdapterReceipts,
        );
        if (receipts.length > 0) {
          const receipt = receipts[0];
          transactionDetailed.receipt = ApiUtils.mergeObjects(
            new TransactionReceipt(),
            receipt,
          );
        }

        const elasticQueryAdapterLogs: ElasticQuery = new ElasticQuery();
        elasticQueryAdapterLogs.pagination = { from: 0, size: 100 };

        const queries = [];
        for (const hash of hashes) {
          queries.push(QueryType.Match('_id', hash));
        }
        elasticQueryAdapterLogs.condition.should = queries;

        const logs: any[] =
          await this.elasticService.getLogsForTransactionHashes(
            elasticQueryAdapterLogs,
          );
        const transactionLogs = logs.map((log) =>
          ApiUtils.mergeObjects(new TransactionLog(), log._source),
        );

        transactionDetailed.operations = this.getOperationsForTransactionLogs(
          txHash,
          transactionLogs,
        );

        for (const log of logs) {
          if (log._id === txHash) {
            transactionDetailed.logs = ApiUtils.mergeObjects(
              new TransactionLog(),
              log._source,
            );
          } else {
            const foundScResult = transactionDetailed.scResults.find(
              ({ hash }) => log._id === hash,
            );
            if (foundScResult) {
              foundScResult.logs = ApiUtils.mergeObjects(
                new TransactionLog(),
                log._source,
              );
            }
          }
        }
      }

      return ApiUtils.mergeObjects(
        new TransactionDetailed(),
        transactionDetailed,
      );
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  getOperationsForTransactionLogs(
    txHash: string,
    logs: TransactionLog[],
  ): TransactionOperation[] {
    const operations: (TransactionOperation | undefined)[] = [];

    for (const log of logs) {
      for (const event of log.events) {
        switch (event.identifier) {
          case TransactionLogEventIdentifier.ESDTNFTTransfer:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.transfer,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTNFTBurn:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.burn,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTNFTAddQuantity:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.addQuantity,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTNFTCreate:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.create,
              ),
            );
            break;
          case TransactionLogEventIdentifier.MultiESDTNFTTransfer:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.multiTransfer,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTTransfer:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.transfer,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTBurn:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.burn,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTLocalMint:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.localMint,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTLocalBurn:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.localBurn,
              ),
            );
            break;
          case TransactionLogEventIdentifier.ESDTWipe:
            operations.push(
              this.getTransactionNftOperation(
                txHash,
                log,
                event,
                TransactionOperationAction.wipe,
              ),
            );
            break;
        }
      }
    }

    return operations
      .filter((operation) => operation !== undefined)
      .map((operation) => operation!);
  }

  private getTransactionNftOperation(
    txHash: string,
    log: TransactionLog,
    event: TransactionLogEvent,
    action: TransactionOperationAction,
  ): TransactionOperation | undefined {
    try {
      let identifier = BinaryUtils.base64Decode(event.topics[0]);
      const nonce = BinaryUtils.tryBase64ToHex(event.topics[1]);
      const value =
        BinaryUtils.tryBase64ToBigInt(event.topics[2])?.toString() ?? '0';
      const receiver =
        BinaryUtils.tryBase64ToAddress(event.topics[3]) ?? log.address;

      let collection: string | undefined = undefined;
      if (nonce) {
        collection = identifier;
        identifier = `${collection}-${nonce}`;
      }

      const type = nonce
        ? TransactionOperationType.nft
        : TransactionOperationType.esdt;

      return {
        action,
        type,
        collection,
        identifier,
        sender: log.address,
        receiver,
        value,
      };
    } catch (error) {
      this.logger.error(
        `Error when parsing NFT transaction log for tx hash '${txHash}' with action '${action}' and topics: ${event.topics}`,
      );
      this.logger.error(error);
      return undefined;
    }
  }

  async tryGetTransactionFromGateway(
    txHash: string,
  ): Promise<TransactionDetailed | null> {
    try {
      const { transaction } = await this.gatewayService.get(
        `transaction/${txHash}?withResults=true`,
      );

      if (transaction.status === 'pending') {
        const existingTransaction =
          await this.tryGetTransactionFromElasticBySenderAndNonce(
            transaction.sender,
            transaction.nonce,
          );
        if (existingTransaction && existingTransaction.txHash !== txHash) {
          return null;
        }
      }

      if (transaction.receipt) {
        transaction.receipt.value = transaction.receipt.value.toString();
      }

      if (transaction.smartContractResults) {
        for (const smartContractResult of transaction.smartContractResults) {
          smartContractResult.callType =
            smartContractResult.callType.toString();
          smartContractResult.value = smartContractResult.value.toString();

          if (smartContractResult.data) {
            smartContractResult.data = BinaryUtils.base64Encode(
              smartContractResult.data,
            );
          }
        }
      }

      const result = {
        txHash: txHash,
        data: transaction.data,
        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,
        gasUsed: transaction.gasUsed,
        miniBlockHash: transaction.miniblockHash,
        senderShard: transaction.sourceShard,
        receiverShard: transaction.destinationShard,
        nonce: transaction.nonce,
        receiver: transaction.receiver,
        sender: transaction.sender,
        signature: transaction.signature,
        status: transaction.status,
        value: transaction.value,
        round: transaction.round,
        fee: transaction.fee,
        timestamp: transaction.timestamp,
        scResults: transaction.smartContractResults
          ? transaction.smartContractResults.map((scResult: any) =>
              ApiUtils.mergeObjects(new SmartContractResult(), scResult),
            )
          : [],
        receipt: transaction.receipt
          ? ApiUtils.mergeObjects(new TransactionReceipt(), transaction.receipt)
          : undefined,
        logs: transaction.logs,
      };

      return ApiUtils.mergeObjects(new TransactionDetailed(), result);
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async createTransaction(
    transaction: TransactionCreate,
  ): Promise<TransactionSendResult | string> {
    const receiverShard = AddressUtils.computeShard(
      AddressUtils.bech32Decode(transaction.receiver),
    );
    const senderShard = AddressUtils.computeShard(
      AddressUtils.bech32Decode(transaction.sender),
    );

    let txHash: string;
    try {
      const result = await this.gatewayService.create(
        'transaction/send',
        transaction,
      );
      txHash = result.txHash;
    } catch (error) {
      this.logger.error(error);
      return error.response.data.error;
    }

    // TODO: pending alignment
    return {
      txHash,
      receiver: transaction.receiver,
      sender: transaction.sender,
      receiverShard,
      senderShard,
      status: 'Pending',
    };
  }
}
