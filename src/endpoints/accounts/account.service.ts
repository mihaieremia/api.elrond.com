/* eslint-disable @typescript-eslint/no-var-requires */
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ElasticService } from '../../common/elastic.service';
import { GatewayService } from '../../common/gateway.service';
import { AccountDetailed } from './entities/account.detailed';
import { Account } from './entities/account';
import { CachingService } from 'src/common/caching.service';
import { VmQueryService } from 'src/endpoints/vm.query/vm.query.service';
import { ApiConfigService } from 'src/common/api.config.service';
import { AccountDeferred } from './entities/account.deferred';
import { QueryPagination } from 'src/common/entities/query.pagination';
import { ElasticPagination } from 'src/common/entities/elastic/elastic.pagination';
import { ElasticSortProperty } from 'src/common/entities/elastic/elastic.sort.property';
import { ElasticSortOrder } from 'src/common/entities/elastic/elastic.sort.order';
import { ElasticQuery } from 'src/common/entities/elastic/elastic.query';
import { QueryType } from 'src/common/entities/elastic/query.type';
import { Constants } from 'src/utils/constants';
import { genesis } from 'src/utils/genesis';
import { nodeSetup } from 'src/utils/nodeSetup';

import { AddressUtils } from 'src/utils/address.utils';
import { ApiUtils } from 'src/utils/api.utils';
import { BinaryUtils } from 'src/utils/binary.utils';
import { TransactionFilter } from '../transactions/entities/transaction.filter';
import {
  Dictionary,
  getEpoch,
  getEpochTimePrice,
  getProfile,
  getTimestampByEpoch,
  getTodayPrice,
  getTodayRates,
  Phase3,
} from 'src/utils/trust.utils';
import {
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.status';
import { TransactionHistory } from '../transactions/entities/transaction.labels';
import { ApiProperty } from '@nestjs/swagger';
import BigNumber from 'bignumber.js';
import { NumberUtils } from 'src/utils/number.utils';
import {
  ProxyProvider,
  SmartContract,
  Address,
  ContractFunction,
  BytesValue,
} from '@elrondnetwork/erdjs';
import { ProviderService } from '../providers/provider.service';
import { TransactionService } from '../transactions/transaction.service';
interface Genesis {
  [Key: string]: GenesisDetails;
}
interface GenesisDetails {
  balance: string;
  delegation: GenesisDelegation;
}

interface GenesisDelegation {
  address: string;
  value: string;
}
interface FullEpochStaked {
  staked: SCEpochStaked;
}

interface SCEpochStaked {
  [Key: string]: number;
}
export class ActionTypes {
  @ApiProperty()
  incoming = 0;
  @ApiProperty()
  outgoing = 0;
  @ApiProperty()
  selfTransfer = 0;
  @ApiProperty()
  scCalls = 0;
}
export class BalanceHystory {
  @ApiProperty()
  incoming = 0;
  @ApiProperty()
  outgoing = 0;
  @ApiProperty()
  selfTransfer = 0;
  @ApiProperty()
  scCalls = 0;
}
export class WaitingListRewards {
  @ApiProperty()
  date = '';
  @ApiProperty()
  epoch = 0;
  @ApiProperty()
  hash = '';
  @ApiProperty()
  usdReward = '';
  @ApiProperty()
  price = '';
  @ApiProperty()
  value = '';
  @ApiProperty()
  label = '';
  @ApiProperty()
  currency = '';
}
export class Rewards {
  @ApiProperty()
  rewardDistributed = '';
  @ApiProperty()
  totalActiveStake = '';
  @ApiProperty()
  serviceFee = '';
  @ApiProperty()
  epoch = 0;
  @ApiProperty()
  staked = '';
  @ApiProperty()
  ownerProfit = '';
  @ApiProperty()
  toBeDistributed = '';
  @ApiProperty()
  APROwner = '';
  @ApiProperty()
  APRDelegator = '';
  @ApiProperty()
  usdRewards = '';
  @ApiProperty()
  reward = '';
  @ApiProperty()
  usdEpoch = 0;
  @ApiProperty()
  date = '';
  @ApiProperty()
  usdRewardsToday = '';
  @ApiProperty()
  unix = 0;
}
export class History {
  @ApiProperty()
  createdAt: Date | undefined = new Date();
  @ApiProperty()
  accountAge = 0;
  @ApiProperty()
  fees = new BigNumber(0);
  @ApiProperty({ type: ActionTypes })
  actionTypes: ActionTypes = new ActionTypes();
  @ApiProperty()
  balanceHistory: Dictionary<BigNumber> = {};
  @ApiProperty()
  available: any = new BigNumber(0);
  @ApiProperty()
  genesisNodes = 0;
  @ApiProperty()
  genesisAmount: any = new BigNumber(0);
  @ApiProperty()
  countTx = 0;
  @ApiProperty()
  points = 50;
  @ApiProperty()
  rewards: any = {};
  @ApiProperty()
  topSenders: Dictionary<number> = {};
  @ApiProperty()
  staked: Dictionary<any> = {};
  @ApiProperty()
  unDelegated: Dictionary<any> = {};
  @ApiProperty()
  epochHistoryStaked: Dictionary<any> = {};
  @ApiProperty()
  phase2ClaimRewards: WaitingListRewards[] = [];
  @ApiProperty()
  waitingListRewards: WaitingListRewards[] = [];
  @ApiProperty()
  privateNodesRewards: WaitingListRewards[] = [];
  @ApiProperty()
  allRedelegations: Dictionary<WaitingListRewards[]> = {};
  @ApiProperty()
  allClaims: Dictionary<WaitingListRewards[]> = {};
  @ApiProperty()
  topReceivers: Dictionary<number> = {};
  @ApiProperty()
  topCalls: Dictionary<number> = {};
  @ApiProperty({ type: TransactionHistory, isArray: true })
  transactions: TransactionHistory[] | undefined = undefined;
}

const epochPrice: Dictionary<string> = {};
@Injectable()
export class AccountService {
  private readonly logger: Logger;

  constructor(
    private readonly elasticService: ElasticService,
    private readonly gatewayService: GatewayService,
    @Inject(forwardRef(() => CachingService))
    private readonly cachingService: CachingService,
    private readonly vmQueryService: VmQueryService,
    private readonly apiConfigService: ApiConfigService,
    private readonly transactionService: TransactionService,
    private readonly providerService: ProviderService,
  ) {
    this.logger = new Logger(AccountService.name);
  }

  async getAccountHistory(
    filter: TransactionFilter,
  ): Promise<TransactionHistory[]> {
    const getSendTransactions = await this.transactionService.getTransactions({
      ...filter,
      size: 10000,
      from: 0,
      status: TransactionStatus.success,
      receiver: undefined,
    });
    const getReceiveTransactions =
      await this.transactionService.getTransactions({
        ...filter,
        size: 10000,
        from: 0,
        status: TransactionStatus.success,
        sender: undefined,
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
  async analyseTransactions(
    txs: TransactionHistory[],
    address: string,
  ): Promise<History> {
    const result = new History();
    const genesisData: Genesis = genesis;
    result.createdAt = txs[0].getDate();
    result.accountAge = daysSinceTime(
      txs[0].timestamp,
      new Date().getTime() / 1000,
    );
    result.countTx = txs.length;
    const firstWalletEpoch = getEpoch(txs[0].timestamp);
    const fetchPrice = [];
    if (address in genesisData) {
      result.points += 50;
      result.available = result.available.plus(
        new BigNumber(
          NumberUtils.denominateFloat(genesisData[address].balance),
        ),
      );
      result.genesisAmount = result.genesisAmount.plus(
        new BigNumber(
          NumberUtils.denominateFloat(genesisData[address].balance),
        ),
      );
      if (
        genesisData[address]['delegation'].address ===
        'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
      ) {
        result.staked[genesisData[address].delegation.address] = new BigNumber(
          NumberUtils.denominateFloat(genesisData[address].delegation.value),
        );

        result.genesisAmount = result.genesisAmount.plus(
          new BigNumber(
            NumberUtils.denominateFloat(genesisData[address].delegation.value),
          ),
        );
      }
      for (const value of nodeSetup['initialNodes']) {
        if (value.address == address) {
          result.points += 25;
          result.genesisNodes += 1;
          if (
            result.staked[
              'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
            ]
          ) {
            result.staked[
              'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
            ] = result.staked[
              'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
            ].plus(new BigNumber(2500));
          } else {
            result.staked[
              'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
            ] = new BigNumber(2500);
          }

          result.genesisAmount = result.genesisAmount.plus(new BigNumber(2500));
        }
      }
    }
    result.genesisAmount = result.genesisAmount.toFixed();

    result.balanceHistory[1] = new BigNumber(result.genesisAmount);

    const todayEpoch = getEpoch(Math.floor(Date.now() / 1000));
    for (const tx of txs) {
      const dateTime = new Date(tx.timestamp * 1000);
      const epoch = getEpoch(tx.timestamp);
      const bigTxValue = new BigNumber(tx.value);
      let txFee = new BigNumber(0);
      // Calculate fees per wallet
      if (parseFloat(tx.fee) > 0 && tx.type !== TransactionType.receiver) {
        txFee = new BigNumber(tx.fee);
        result.fees = result.fees.plus(txFee);
        result.available = result.available.minus(txFee);
      }
      // Calculate fees per wallet

      // Balance Hstory per epoch
      if (epoch in result.balanceHistory) {
        if (tx.type !== TransactionType.receiver) {
          result.balanceHistory[epoch] =
            result.balanceHistory[epoch].minus(txFee);
        }
        if (tx.type === TransactionType.receiver) {
          result.balanceHistory[epoch] =
            result.balanceHistory[epoch].plus(bigTxValue);
        } else if (tx.type === TransactionType.transfer) {
          result.balanceHistory[epoch] =
            result.balanceHistory[epoch].minus(bigTxValue);
        } else if (tx.type === TransactionType.functionCall) {
          if (
            ['claimRewards', 'reDelegateRewards'].includes(tx.method as string)
          ) {
            if (tx.method === 'reDelegateRewards') {
              let pricePerEpoch: string;
              if (epoch in epochPrice) {
                pricePerEpoch = epochPrice[epoch];
              } else {
                pricePerEpoch = (
                  await getEpochTimePrice(epoch, tx.timestamp, '')
                ).price;
                epochPrice[epoch] = pricePerEpoch;
              }
              if (!result.allRedelegations[tx.receiver]) {
                result.allRedelegations[tx.receiver] = [];
              }
              result.allRedelegations[tx.receiver].push({
                date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
                value: tx.value,
                epoch: epoch,
                hash: tx.txHash,
                price: pricePerEpoch,
                label: 'reward',
                currency: 'EGLD',
                usdReward: (
                  parseFloat(pricePerEpoch) * parseFloat(tx.value)
                ).toFixed(4),
              });
            }
            if (
              tx.method === 'claimRewards' &&
              tx.receiver ===
                'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
            ) {
              let pricePerEpoch: string;
              if (epoch in epochPrice) {
                pricePerEpoch = epochPrice[epoch];
              } else {
                pricePerEpoch = (
                  await getEpochTimePrice(epoch, tx.timestamp, '')
                ).price;
                epochPrice[epoch] = pricePerEpoch;
              }
              result.phase2ClaimRewards.push({
                date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
                value: tx.value,
                epoch: epoch,
                hash: tx.txHash,
                price: pricePerEpoch,
                label: 'income',
                currency: 'EGLD',
                usdReward: (
                  parseFloat(pricePerEpoch) * parseFloat(tx.value)
                ).toFixed(4),
              });
            }

            if (
              tx.method === 'claimRewards' &&
              tx.receiver !==
                'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
            ) {
              if (!result.allClaims[tx.receiver]) {
                result.allClaims[tx.receiver] = [];
              }
              let pricePerEpoch: string;
              if (epoch in epochPrice) {
                pricePerEpoch = epochPrice[epoch];
              } else {
                pricePerEpoch = (
                  await getEpochTimePrice(epoch, tx.timestamp, '')
                ).price;
                epochPrice[epoch] = pricePerEpoch;
              }
              result.allClaims[tx.receiver].push({
                date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
                value: tx.value,
                epoch: epoch,
                hash: tx.txHash,
                price: pricePerEpoch,
                label: 'income',
                currency: 'EGLD',
                usdReward: (
                  parseFloat(pricePerEpoch) * parseFloat(tx.value)
                ).toFixed(4),
              });
            }
          } else if (tx.method === 'unBond') {
            if (parseFloat(tx.fee) < 0) {
              txFee = new BigNumber('0.031760467');

              result.fees = result.fees.plus(txFee);
              result.available = result.available.minus(txFee);
              result.balanceHistory[epoch] =
                result.balanceHistory[epoch].minus(txFee);
            }
          } else if (tx.method === 'unStake') {
            if (parseFloat(tx.fee) < 0) {
              txFee = new BigNumber('0.036805533');
              result.fees = result.fees.plus(txFee);
              result.available = result.available.minus(txFee);
              result.balanceHistory[epoch] =
                result.balanceHistory[epoch].minus(txFee);
            }
          } else if (tx.method === 'stake') {
            if (parseFloat(tx.fee) < 0) {
              txFee = new BigNumber('0.039378847');
              result.fees = result.fees.plus(txFee);
              result.available = result.available.minus(txFee);
              result.balanceHistory[epoch] =
                result.balanceHistory[epoch].minus(txFee);
            }
          }
        }
      } else {
        if (tx.type !== TransactionType.receiver) {
          result.balanceHistory[epoch] = new BigNumber(0).minus(txFee);
        }
        if (tx.type === TransactionType.receiver) {
          result.balanceHistory[epoch] = bigTxValue;
        } else if (tx.type === TransactionType.transfer) {
          result.balanceHistory[epoch] = new BigNumber(0).minus(bigTxValue);
        } else if (tx.type === TransactionType.functionCall) {
          if (
            ['claimRewards', 'reDelegateRewards'].includes(tx.method as string)
          ) {
            if (tx.method === 'reDelegateRewards') {
              let pricePerEpoch: string;
              if (epoch in epochPrice) {
                pricePerEpoch = epochPrice[epoch];
              } else {
                pricePerEpoch = (
                  await getEpochTimePrice(epoch, tx.timestamp, '')
                ).price;
                epochPrice[epoch] = pricePerEpoch;
              }
              if (!result.allRedelegations[tx.receiver]) {
                result.allRedelegations[tx.receiver] = [];
              }
              result.allRedelegations[tx.receiver].push({
                date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
                value: tx.value,
                epoch: epoch,
                hash: tx.txHash,
                price: pricePerEpoch,
                label: 'reward',
                currency: 'EGLD',
                usdReward: (
                  parseFloat(pricePerEpoch) * parseFloat(tx.value)
                ).toFixed(4),
              });
            }
            if (
              tx.method === 'claimRewards' &&
              tx.receiver ===
                'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
            ) {
              let pricePerEpoch: string;
              if (epoch in epochPrice) {
                pricePerEpoch = epochPrice[epoch];
              } else {
                pricePerEpoch = (
                  await getEpochTimePrice(epoch, tx.timestamp, '')
                ).price;
                epochPrice[epoch] = pricePerEpoch;
              }
              result.phase2ClaimRewards.push({
                date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
                value: tx.value,
                epoch: epoch,
                hash: tx.txHash,
                price: pricePerEpoch,
                label: 'income',
                currency: 'EGLD',
                usdReward: (
                  parseFloat(pricePerEpoch) * parseFloat(tx.value)
                ).toFixed(4),
              });
            }

            if (
              tx.method === 'claimRewards' &&
              tx.receiver !==
                'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
            ) {
              if (!result.allClaims[tx.receiver]) {
                result.allClaims[tx.receiver] = [];
              }
              let pricePerEpoch: string;
              if (epoch in epochPrice) {
                pricePerEpoch = epochPrice[epoch];
              } else {
                pricePerEpoch = (
                  await getEpochTimePrice(epoch, tx.timestamp, '')
                ).price;
                epochPrice[epoch] = pricePerEpoch;
              }
              result.allClaims[tx.receiver].push({
                date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
                value: tx.value,
                epoch: epoch,
                hash: tx.txHash,
                price: pricePerEpoch,
                label: 'income',
                currency: 'EGLD',
                usdReward: (
                  parseFloat(pricePerEpoch) * parseFloat(tx.value)
                ).toFixed(4),
              });
            }
          } else if (tx.method === 'unBond') {
            if (parseFloat(tx.fee) < 0) {
              txFee = new BigNumber('0.031760467');
              result.fees = result.fees.plus(txFee);
              result.available = result.available.minus(txFee);
              result.balanceHistory[epoch] = new BigNumber(0).minus(txFee);
            }
          } else if (tx.method === 'unStake') {
            if (parseFloat(tx.fee) < 0) {
              txFee = new BigNumber('0.036805533');
              result.fees = result.fees.plus(txFee);
              result.available = result.available.minus(txFee);
              result.balanceHistory[epoch] = new BigNumber(0).minus(txFee);
            }
          } else if (tx.method === 'stake') {
            if (parseFloat(tx.fee) < 0) {
              txFee = new BigNumber('0.039378847');
              result.fees = result.fees.plus(txFee);
              result.available = result.available.minus(txFee);
              result.balanceHistory[epoch] = new BigNumber(0).minus(txFee);
            }
          }
        }
      }

      // Balance Hstory per epoch
      fetchPrice.push(getEpochTimePrice(epoch, tx.timestamp, tx.txHash));

      if (tx.type === TransactionType.transfer) {
        result.available = result.available.minus(bigTxValue);
        result.actionTypes.outgoing += 1;
      }
      if (tx.type === TransactionType.receiver) {
        if (
          tx.sender ===
          'erd1au4chwnhwl6uhykpuydzagc8qekwwmpar0v0m2xkjjfm52hp6veszyz54d'
        ) {
          let pricePerEpoch: string;
          if (epoch in epochPrice) {
            pricePerEpoch = epochPrice[epoch];
          } else {
            pricePerEpoch = (await getEpochTimePrice(epoch, tx.timestamp, ''))
              .price;
            epochPrice[epoch] = pricePerEpoch;
          }
          result.waitingListRewards.push({
            date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
            value: tx.value,
            epoch: epoch,
            hash: tx.txHash,
            price: pricePerEpoch,
            label: 'income',
            currency: 'EGLD',
            usdReward: (
              parseFloat(pricePerEpoch) * parseFloat(tx.value)
            ).toFixed(4),
          });
        } else if (tx.sender === '4294967295') {
          let pricePerEpoch: string;
          if (epoch in epochPrice) {
            pricePerEpoch = epochPrice[epoch];
          } else {
            pricePerEpoch = (await getEpochTimePrice(epoch, tx.timestamp, ''))
              .price;
            epochPrice[epoch] = pricePerEpoch;
          }
          result.privateNodesRewards.push({
            date: dateTime.toLocaleString('en-GB', { timeZone: 'UTC' }),
            value: tx.value,
            epoch: epoch,
            hash: tx.txHash,
            price: pricePerEpoch,
            label: 'income',
            currency: 'EGLD',
            usdReward: (
              parseFloat(pricePerEpoch) * parseFloat(tx.value)
            ).toFixed(4),
          });
        }
        result.actionTypes.incoming += 1;
        result.available = result.available.plus(bigTxValue);
      }
      if (tx.type === TransactionType.self) {
        result.actionTypes.selfTransfer += 1;
      }
      if (tx.type === TransactionType.functionCall) {
        result.actionTypes.scCalls += 1;
      }
      if (tx.points) {
        result.points += tx.points;
      }
      if (tx.receiver === address) {
        if (tx.sender in result.topSenders) {
          result.topSenders[tx.sender] += 1;
        } else {
          result.topSenders[tx.sender] = 1;
        }
      }
      if (tx.sender === address) {
        if (tx.receiver in result.topReceivers) {
          result.topReceivers[tx.receiver] += 1;
        } else {
          result.topReceivers[tx.receiver] = 1;
        }
      }
      if (tx.method) {
        if (tx.method in result.topCalls) {
          result.topCalls[tx.method] += 1;
        } else {
          result.topCalls[tx.method] = 1;
        }
      }

      switch (tx.method) {
        case 'makeNewContractFromValidatorData':
          for (const scResult of tx.scResults) {
            const data = scResult.data;

            if (data !== undefined) {
              const data_list = data.split('@');
              if (data_list[1] == 'ok') {
                const agency = data_list[2];
                result.epochHistoryStaked[epoch] = {
                  ...result.epochHistoryStaked[epoch],
                  staked: {
                    [agency]: new BigNumber(
                      result.staked[
                        'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
                      ],
                    ),
                  },
                };
                result.staked = {
                  ...result.staked,
                  [agency]: new BigNumber(
                    result.staked[
                      'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
                    ],
                  ),
                };
                delete result.staked[
                  'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
                ];
              }
            }
          }
          break;
        case 'mergeValidatorToDelegationWithWhitelist':
          const agency = AddressUtils.bech32Encode(tx.data.split('@')[1]);

          if (result.staked[agency]) {
            result.staked[agency] = result.staked[agency].plus(
              new BigNumber(
                result.staked[
                  'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
                ],
              ),
            );
            console.log(
              result.staked[
                'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
              ],
            );
            if (!result.epochHistoryStaked[epoch]) {
              result.epochHistoryStaked[epoch] = {
                staked: {
                  [agency]: new BigNumber(result.staked[agency]),
                },
              };
            } else {
              if (!result.epochHistoryStaked[epoch].staked[agency]) {
                result.epochHistoryStaked[epoch].staked[agency] = new BigNumber(
                  result.staked[agency],
                );
              } else {
                result.epochHistoryStaked[epoch].staked[agency] = new BigNumber(
                  result.staked[agency],
                );
              }
            }
          } else {
            result.staked[agency] = new BigNumber(
              result.staked[
                'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
              ],
            );
            if (!result.epochHistoryStaked[epoch]) {
              result.epochHistoryStaked[epoch] = {
                staked: {
                  [agency]: new BigNumber(
                    result.staked[
                      'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
                    ],
                  ),
                },
              };
            } else {
              result.epochHistoryStaked[epoch].staked = {
                ...result.epochHistoryStaked[epoch].staked,
                [agency]: new BigNumber(
                  result.staked[
                    'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
                  ],
                ),
              };
            }
          }
          delete result.staked[
            'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
          ];
          break;
        case 'delegate':
          if (result.staked[tx.receiver]) {
            result.staked[tx.receiver] =
              result.staked[tx.receiver].plus(bigTxValue);
            if (!result.epochHistoryStaked[epoch]) {
              result.epochHistoryStaked[epoch] = {
                staked: {
                  [tx.receiver]: result.staked[tx.receiver],
                },
              };
            } else {
              if (!result.epochHistoryStaked[epoch].staked[tx.receiver]) {
                result.epochHistoryStaked[epoch].staked[tx.receiver] =
                  result.staked[tx.receiver];
              } else {
                result.epochHistoryStaked[epoch].staked[tx.receiver] =
                  result.staked[tx.receiver];
              }
            }
          } else {
            result.staked[tx.receiver] = new BigNumber(tx.value);
            if (!result.epochHistoryStaked[epoch]) {
              result.epochHistoryStaked[epoch] = {
                staked: {
                  [tx.receiver]: new BigNumber(tx.value),
                },
              };
            } else {
              result.epochHistoryStaked[epoch].staked = {
                ...result.epochHistoryStaked[epoch].staked,
                [tx.receiver]: new BigNumber(tx.value),
              };
            }
          }
          result.available = result.available.minus(bigTxValue);
          break;
        case 'reDelegateRewards':
          if (tx.receiver in result.staked) {
            result.staked[tx.receiver] =
              result.staked[tx.receiver].plus(bigTxValue);
            if (!result.epochHistoryStaked[epoch]) {
              result.epochHistoryStaked[epoch] = {
                staked: {
                  [tx.receiver]: result.staked[tx.receiver],
                },
              };
            } else {
              if (!result.epochHistoryStaked[epoch].staked[tx.receiver]) {
                result.epochHistoryStaked[epoch].staked[tx.receiver] =
                  result.staked[tx.receiver];
              } else {
                result.epochHistoryStaked[epoch].staked[tx.receiver] =
                  result.staked[tx.receiver];
              }
            }
          } else {
            result.staked[tx.receiver] = bigTxValue;
          }
          break;
        case 'claimRewards':
          result.available = result.available.plus(bigTxValue);
          break;
        case 'unDelegate':
          if (!result.unDelegated[tx.receiver]) {
            result.unDelegated[tx.receiver] = new BigNumber(0);
          }
          if (!result.staked[tx.receiver]) {
            result.staked[tx.receiver] = new BigNumber(0);
          }

          result.unDelegated[tx.receiver] =
            result.unDelegated[tx.receiver].plus(bigTxValue);
          result.staked[tx.receiver] =
            result.staked[tx.receiver].minus(bigTxValue);
          if (!result.epochHistoryStaked[epoch]) {
            result.epochHistoryStaked[epoch] = {
              staked: {
                [tx.receiver]: result.staked[tx.receiver],
              },
            };
          } else {
            if (!result.epochHistoryStaked[epoch].staked[tx.receiver]) {
              result.epochHistoryStaked[epoch].staked[tx.receiver] =
                result.staked[tx.receiver];
            } else {
              result.epochHistoryStaked[epoch].staked[tx.receiver] =
                result.staked[tx.receiver];
            }
          }

          break;
        case 'withdraw':
          result.unDelegated[tx.receiver] =
            result.unDelegated[tx.receiver].minus(bigTxValue);
          result.available = result.available.plus(bigTxValue);
          break;
        case 'createNewDelegationContract':
          tx.scResults.forEach((scTX: any) => {
            if (scTX.data !== undefined) {
              const agency = scTX.data.split('@')[2];
              result.staked = {
                [agency]: bigTxValue,
              };
              result.epochHistoryStaked[epoch] = {
                staked: {
                  [agency]: bigTxValue,
                },
              };
            }
          });
          result.available = result.available.minus(bigTxValue);

          break;
        case 'stake':
          result.available = result.available.minus(bigTxValue);
          if (!(tx.receiver in result.staked)) {
            result.staked[tx.receiver] = bigTxValue;
          } else {
            result.staked[tx.receiver] =
              result.staked[tx.receiver].plus(bigTxValue);
          }
          break;
        case 'unStake':
          if (
            tx.receiver ===
            'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
          ) {
            if (!(tx.receiver in result.unDelegated)) {
              result.unDelegated[tx.receiver] = bigTxValue;
            } else {
              result.unDelegated[tx.receiver] =
                result.unDelegated[tx.receiver].plus(bigTxValue);
            }
            if (result.staked[tx.receiver]) {
              result.staked[tx.receiver] =
                result.staked[tx.receiver].minus(bigTxValue);
            }
          }

          break;
        case 'unStakeTokens':
          if (
            tx.receiver ===
            'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
          ) {
            if (!(tx.receiver in result.unDelegated)) {
              result.unDelegated[tx.receiver] = bigTxValue;
            } else {
              result.unDelegated[tx.receiver] =
                result.unDelegated[tx.receiver].plus(bigTxValue);
            }
            if (result.staked[tx.receiver]) {
              result.staked[tx.receiver] =
                result.staked[tx.receiver].minus(bigTxValue);
            }
          }

          break;
        case 'unBond':
          result.available = result.available.plus(bigTxValue);
          if (
            tx.receiver ==
            'erd1qqqqqqqqqqqqqpgqxwakt2g7u9atsnr03gqcgmhcv38pt7mkd94q6shuwt'
          ) {
            result.unDelegated[tx.receiver] =
              result.unDelegated[tx.receiver].minus(bigTxValue);
          }
          break;
        case 'unBondTokens':
          result.available = result.available.plus(bigTxValue);
          if (
            tx.receiver ==
            'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l'
          ) {
            result.unDelegated[tx.receiver] =
              result.unDelegated[tx.receiver].minus(bigTxValue);
          }
          break;
      }
    }

    result.transactions = txs;
    result.points += result.accountAge * 5;
    result.topSenders = sortJSON(result.topSenders);
    result.topCalls = sortJSON(result.topCalls);
    result.topReceivers = sortJSON(result.topReceivers);

    // Merge tx price
    const priceResponses = await Promise.all(fetchPrice);
    let prices: Dictionary<string> = {};
    for (const response of priceResponses) {
      prices = { ...prices, [response.txHash]: response.price };
    }
    result.transactions = result.transactions.map((tx) => {
      tx.price = parseFloat(prices[tx.txHash]);
      return tx;
    });
    // Merge tx price

    Object.keys(result.staked).forEach(function (address) {
      if (result.staked[address].isLessThan(new BigNumber(1))) {
        delete result.staked[address];
      } else {
        result.staked[address] = result.staked[address];
      }
    });
    Object.keys(result.epochHistoryStaked).forEach(function (epoch) {
      Object.keys(result.epochHistoryStaked[epoch].staked).forEach(
        (address) => {
          result.epochHistoryStaked[epoch].staked[address] =
            result.epochHistoryStaked[epoch].staked[address].toFixed();
        },
      );
    });

    Object.keys(result.unDelegated).forEach(function (address) {
      if (result.unDelegated[address].lte(new BigNumber(0.0))) {
        delete result.unDelegated[address];
      } else {
        result.unDelegated[address] = result.unDelegated[address].toFixed();
      }
    });
    result.rewards = await this.getRewardsHistory(result, address);

    Object.keys(result.rewards.rewards_per_epoch).forEach((SC: string) => {
      result.rewards.rewards_per_epoch[SC].forEach((reward: Rewards) => {
        if (reward.epoch in result.balanceHistory) {
          result.balanceHistory[reward.epoch] = result.balanceHistory[
            reward.epoch
          ].plus(new BigNumber(reward.reward));
        } else {
          result.balanceHistory[reward.epoch] = new BigNumber(reward.reward);
        }
      });
    });
    // Compute balance history per epoch
    let lastEpochHistoryTotal = new BigNumber(0);
    const historyBalance: Dictionary<BigNumber> = {};
    for (let epoch = firstWalletEpoch; epoch <= todayEpoch; epoch++) {
      if (epoch in result.balanceHistory) {
        lastEpochHistoryTotal = lastEpochHistoryTotal.plus(
          result.balanceHistory[epoch],
        );
        historyBalance[epoch] = lastEpochHistoryTotal;
      } else {
        historyBalance[epoch] = lastEpochHistoryTotal;
      }
    }
    result.balanceHistory = historyBalance;
    // Compute balance history per epoch

    return result;
  }

  async getAccountsCount(): Promise<number> {
    return await this.cachingService.getOrSetCache(
      'account:count',
      async () => await this.elasticService.getCount('accounts'),
      Constants.oneMinute(),
    );
  }

  async getAccount(address: string): Promise<AccountDetailed | null> {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.condition.should = [
      QueryType.Match('sender', address),
      QueryType.Match('receiver', address),
    ];

    try {
      const [
        txCount,
        {
          account: { nonce, balance, code, codeHash, rootHash, username },
        },
      ] = await Promise.all([
        this.elasticService.getCount('transactions', elasticQueryAdapter),
        this.gatewayService.get(`address/${address}`),
      ]);

      const shard = AddressUtils.computeShard(
        AddressUtils.bech32Decode(address),
      );

      const result = {
        address,
        nonce,
        balance,
        code,
        codeHash,
        rootHash,
        txCount,
        username,
        shard,
      };

      return result;
    } catch (error) {
      this.logger.error(error);
      this.logger.error(
        `Error when getting account details for address '${address}'`,
      );
      return null;
    }
  }

  async getAccounts(queryPagination: QueryPagination): Promise<Account[]> {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();

    const { from, size } = queryPagination;
    const pagination: ElasticPagination = {
      from,
      size,
    };
    elasticQueryAdapter.pagination = pagination;

    const balanceNum: ElasticSortProperty = {
      name: 'balanceNum',
      order: ElasticSortOrder.descending,
    };
    elasticQueryAdapter.sort = [balanceNum];

    const result = await this.elasticService.getList(
      'accounts',
      'address',
      elasticQueryAdapter,
    );

    const accounts: Account[] = result.map((item) =>
      ApiUtils.mergeObjects(new Account(), item),
    );
    for (const account of accounts) {
      account.shard = AddressUtils.computeShard(
        AddressUtils.bech32Decode(account.address),
      );
    }

    return accounts;
  }

  async getDeferredAccount(address: string): Promise<AccountDeferred[]> {
    const publicKey = AddressUtils.bech32Decode(address);

    const [
      encodedUserDeferredPaymentList,
      [encodedNumBlocksBeforeUnBond],
      {
        status: { erd_nonce: erdNonceString },
      },
    ] = await Promise.all([
      this.vmQueryService.vmQuery(
        this.apiConfigService.getDelegationContractAddress(),
        'getUserDeferredPaymentList',
        undefined,
        [publicKey],
      ),
      this.vmQueryService.vmQuery(
        this.apiConfigService.getDelegationContractAddress(),
        'getNumBlocksBeforeUnBond',
        undefined,
        [],
      ),
      this.gatewayService.get(
        `network/status/${this.apiConfigService.getDelegationContractShardId()}`,
      ),
    ]);

    const numBlocksBeforeUnBond = parseInt(
      this.decode(encodedNumBlocksBeforeUnBond),
    );
    const erdNonce = parseInt(erdNonceString);

    const data: AccountDeferred[] = encodedUserDeferredPaymentList.reduce(
      (result: AccountDeferred[], _, index, array) => {
        if (index % 2 === 0) {
          const [encodedDeferredPayment, encodedUnstakedNonce] = array.slice(
            index,
            index + 2,
          );

          const deferredPayment = this.decode(encodedDeferredPayment);
          const unstakedNonce = parseInt(this.decode(encodedUnstakedNonce));
          const blocksLeft = Math.max(
            0,
            unstakedNonce + numBlocksBeforeUnBond - erdNonce,
          );
          const secondsLeft = blocksLeft * 6; // 6 seconds per block

          result.push({ deferredPayment, secondsLeft });
        }

        return result;
      },
      [],
    );

    return data;
  }

  async getKeys(
    address: string,
  ): Promise<
    { blsKey: string; stake: string; status: string; rewardAddress: string }[]
  > {
    const publicKey = AddressUtils.bech32Decode(address);

    const BlsKeysStatus = await this.vmQueryService.vmQuery(
      this.apiConfigService.getAuctionContractAddress(),
      'getBlsKeysStatus',
      this.apiConfigService.getAuctionContractAddress(),
      [publicKey],
    );

    if (!BlsKeysStatus) {
      return [];
    }

    const queued: any = [];

    const data = BlsKeysStatus.reduce((result: any, _, index, array) => {
      if (index % 2 === 0) {
        const [encodedBlsKey, encodedStatus] = array.slice(index, index + 2);

        const blsKey = BinaryUtils.padHex(
          Buffer.from(encodedBlsKey, 'base64').toString('hex'),
        );
        const status = Buffer.from(encodedStatus, 'base64').toString();
        const stake = '2500000000000000000000';

        if (status === 'queued') {
          queued.push(blsKey);
        }

        result.push({ blsKey, stake, status });
      }
      return result;
    }, []);

    if (data && data[0] && data[0].blsKey) {
      const [encodedRewardsPublicKey] = await this.vmQueryService.vmQuery(
        this.apiConfigService.getStakingContractAddress(),
        'getRewardAddress',
        undefined,
        [data[0].blsKey],
      );

      const rewardsPublicKey = Buffer.from(
        encodedRewardsPublicKey,
        'base64',
      ).toString();
      const rewardAddress = AddressUtils.bech32Encode(rewardsPublicKey);

      for (const [index, _] of data.entries()) {
        data[index].rewardAddress = rewardAddress;
      }
    }

    if (queued.length) {
      const results = await Promise.all([
        this.vmQueryService.vmQuery(
          this.apiConfigService.getStakingContractAddress(),
          'getQueueSize',
        ),
        ...queued.map((blsKey: string) =>
          this.vmQueryService.vmQuery(
            this.apiConfigService.getStakingContractAddress(),
            'getQueueIndex',
            this.apiConfigService.getAuctionContractAddress(),
            [blsKey],
          ),
        ),
      ]);

      let queueSize = '0';
      results.forEach(([result], index) => {
        if (index === 0) {
          queueSize = Buffer.from(result, 'base64').toString();
        } else {
          const [found] = data.filter(
            (x: any) => x.blsKey === queued[index - 1],
          );

          found.queueIndex = Buffer.from(result, 'base64').toString();
          found.queueSize = queueSize;
        }
      });
    }

    return data;
  }
  async getRewardsHistory(data: History, address: string) {
    const todayPrice = await getTodayPrice();
    const todayRates = await getTodayRates();
    const fullEpochsStakedAmounts: Dictionary<FullEpochStaked> = {};
    const todayEpoch = getEpoch(Math.floor(Date.now() / 1000));
    const lastEpochHistory: Dictionary<number> = {};
    const result: Dictionary<Rewards[]> = {};
    const providers: Dictionary<boolean> = {};
    const total: Dictionary<BigNumber> = {};
    const totalUSD: Dictionary<BigNumber> = {};
    const avgPriceReward: Dictionary<BigNumber> = {};
    const avgAPR: Dictionary<BigNumber> = {};
    const avgEGLD: Dictionary<BigNumber> = {};

    const calculateRewardPerSC = async (
      agencySC: string,
      epoch: number,
      todayPrice: number,
    ) => {
      const savedStaked = fullEpochsStakedAmounts[epoch].staked[agencySC];
      const agencyInfo = await calculateReward(
        epoch,
        savedStaked,
        agencySC,
        providers[agencySC] || false,
        todayPrice,
      );
      if (!total[agencySC]) {
        total[agencySC] = new BigNumber(agencyInfo['reward']);
      } else {
        total[agencySC] = total[agencySC].plus(
          new BigNumber(agencyInfo['reward']),
        );
      }

      if (!totalUSD[agencySC]) {
        totalUSD[agencySC] = new BigNumber(agencyInfo['usdRewards']);
        avgPriceReward[agencySC] = new BigNumber(agencyInfo['usdEpoch']);
        avgAPR[agencySC] = new BigNumber(agencyInfo['APRDelegator']);
        avgEGLD[agencySC] = new BigNumber(agencyInfo['reward']);
      } else {
        totalUSD[agencySC] = totalUSD[agencySC].plus(
          new BigNumber(agencyInfo['usdRewards']),
        );
        avgAPR[agencySC] = avgAPR[agencySC].plus(
          new BigNumber(agencyInfo['APRDelegator']),
        );
        avgPriceReward[agencySC] = avgPriceReward[agencySC].plus(
          new BigNumber(agencyInfo['usdEpoch']),
        );
        avgEGLD[agencySC] = avgEGLD[agencySC].plus(
          new BigNumber(agencyInfo['reward']),
        );
      }

      if (!result[agencySC]) {
        result[agencySC] = [];
      }

      result[agencySC].push({
        ...agencyInfo,
      });
    };
    for (const agencySC of Object.keys(data.staked)) {
      if (!providers[agencySC]) {
        providers[agencySC] = await isOwner(agencySC, address);
      }
    }
    const promisesEpoch = [];
    for (let epoch = Phase3.epoch - 15; epoch <= todayEpoch; epoch++) {
      if (epoch in data.epochHistoryStaked) {
        Object.keys(lastEpochHistory).forEach((SC) => {
          if (!fullEpochsStakedAmounts[epoch]) {
            fullEpochsStakedAmounts[epoch] = { staked: {} };
          }
          if (lastEpochHistory[SC] > 0) {
            fullEpochsStakedAmounts[epoch].staked = {
              ...fullEpochsStakedAmounts[epoch].staked,
              [SC]: lastEpochHistory[SC],
            };
          } else {
            delete lastEpochHistory[SC];
          }
        });
        Object.keys(data.epochHistoryStaked[epoch].staked).forEach(
          (agencySC) => {
            lastEpochHistory[agencySC] =
              data.epochHistoryStaked[epoch].staked[agencySC];
          },
        );
        if (
          epoch > Phase3.epoch &&
          fullEpochsStakedAmounts[epoch] &&
          fullEpochsStakedAmounts[epoch].staked !== undefined
        ) {
          for (const agencySC of Object.keys(
            fullEpochsStakedAmounts[epoch].staked,
          )) {
            promisesEpoch.push(
              calculateRewardPerSC(agencySC, epoch, todayPrice),
            );
          }
        }
      } else {
        Object.keys(lastEpochHistory).forEach((SC) => {
          if (!fullEpochsStakedAmounts[epoch]) {
            fullEpochsStakedAmounts[epoch] = { staked: {} };
          }

          if (lastEpochHistory[SC] > 0) {
            fullEpochsStakedAmounts[epoch].staked = {
              ...fullEpochsStakedAmounts[epoch].staked,
              [SC]: lastEpochHistory[SC],
            };
          } else {
            delete lastEpochHistory[SC];
          }
        });
        if (
          epoch > Phase3.epoch &&
          fullEpochsStakedAmounts[epoch] &&
          fullEpochsStakedAmounts[epoch].staked !== undefined
        ) {
          for (const agencySC of Object.keys(
            fullEpochsStakedAmounts[epoch].staked,
          )) {
            promisesEpoch.push(
              calculateRewardPerSC(agencySC, epoch, todayPrice),
            );
          }
        }
      }
    }

    await Promise.all(promisesEpoch);

    const metaDataPromises = [];
    const keybaseIDs: Dictionary<any> = {};
    let full_total = new BigNumber(0);
    let fullUSD_total = new BigNumber(0);

    const final_result: Dictionary<Rewards[]> = {};
    const final_total: Dictionary<number> = {};
    const final_totalUSD: Dictionary<number> = {};
    const final_avgPriceReward: Dictionary<number> = {};
    const final_avgRewardDaily: Dictionary<number> = {};
    const final_avgAPR: Dictionary<number> = {};
    const final_avgEGLD: Dictionary<number> = {};

    for (const scAddress of Object.keys(total)) {
      full_total = full_total.plus(total[scAddress]);
      fullUSD_total = fullUSD_total.plus(totalUSD[scAddress]);
      final_total[scAddress] = parseFloat(total[scAddress].toFixed());
      final_avgPriceReward[scAddress] = avgPriceReward[scAddress]
        .dividedBy(result[scAddress].length)
        .toNumber();
      final_avgRewardDaily[scAddress] = totalUSD[scAddress]
        .dividedBy(result[scAddress].length)
        .toNumber();
      final_avgAPR[scAddress] = avgAPR[scAddress]
        .dividedBy(result[scAddress].length)
        .toNumber();
      final_avgEGLD[scAddress] = parseFloat(
        avgEGLD[scAddress].dividedBy(result[scAddress].length).toString(),
      );
      final_totalUSD[scAddress] = parseFloat(totalUSD[scAddress].toFixed());
      metaDataPromises.push(
        this.providerService.getProviderMetadata(scAddress),
      );
    }
    const getProfileResponses = [];
    const metaDataResponse = await Promise.all(metaDataPromises);
    for (const response of metaDataResponse) {
      getProfileResponses.push(getProfile(response['identity']));
    }
    // let fifoRewards = [];
    const keybaseReponses = await Promise.all(getProfileResponses);
    Object.keys(final_total).forEach((SC, index) => {
      result[SC].sort(function (a, b) {
        return b.epoch - a.epoch;
      });
      final_result[SC] = result[SC];
      keybaseIDs[SC] = keybaseReponses[index];
    });
    const toReturn = {
      todayRates,
      rewards_per_epoch: final_result,
      keybase: keybaseIDs,
      total_per_provider: final_total,
      avgPrice_per_provider: final_avgPriceReward,
      avgAPR_per_provider: final_avgAPR,
      avgEGLD_per_provider: final_avgEGLD,
      avgUSDProvider: final_avgRewardDaily,
      totalUSD_per_provider: final_totalUSD,
      activeStaked: data.staked,
      total: parseFloat(full_total.toFixed()),
      totalUSD: parseFloat(fullUSD_total.toFixed()),
    };
    return { ...toReturn };
  }

  decode(value: string): string {
    const hex = Buffer.from(value, 'base64').toString('hex');
    return BigInt(hex ? '0x' + hex : hex).toString();
  }
}

function sortJSON(jsObj: any): Dictionary<number> {
  const sortedArray = [];
  for (const i in jsObj) {
    sortedArray.push([jsObj[i], i]);
  }
  const sorted = sortedArray.sort(function (a, b) {
    return b[0] - a[0];
  });
  const result: Dictionary<number> = {};
  sorted.forEach((wallet) => {
    result[wallet[1]] = wallet[0];
  });
  return result;
}

const removeDuplicate = (arr: TransactionHistory[]) => {
  const appeared: Dictionary<number> = {};
  for (let i = 0; i < arr.length; ) {
    if (!appeared.hasOwnProperty(arr[i].txHash)) {
      appeared[arr[i].txHash] = 1;
      i++;
      continue;
    }
    arr.splice(i, 1);
  }
};

function daysSinceTime($start_ts: number, $end_ts: number) {
  const diff = $end_ts - $start_ts;
  return Math.round(diff / 86400);
}

function DecimalHexTwosComplement(decimal: number) {
  const size = 8;
  let hexadecimal = '';
  if (decimal >= 0) {
    hexadecimal = decimal.toString(16);

    while (hexadecimal.length % size != 0) {
      hexadecimal = '' + 0 + hexadecimal;
    }

    return hexadecimal;
  } else {
    hexadecimal = Math.abs(decimal).toString(16);
    while (hexadecimal.length % size != 0) {
      hexadecimal = '' + 0 + hexadecimal;
    }

    let output = '';
    for (let i = 0; i < hexadecimal.length; i++) {
      output += (0x0f - parseInt(hexadecimal[i], 16)).toString(16);
    }

    output = (0x01 + parseInt(output, 16)).toString(16);
    return output;
  }
}
function hexToDec(hex: string) {
  return hex
    .toLowerCase()
    .split('')
    .reduce((result, ch) => result * 16 + '0123456789abcdefgh'.indexOf(ch), 0);
}
const calculateReward = async (
  epoch: number,
  amount: number,
  agency: string,
  isOwner: boolean,
  todayPrice: number,
): Promise<Rewards> => {
  const provider = new ProxyProvider('http://65.108.7.21:8079', {
    timeout: 25000,
  });
  const delegationContract = new SmartContract({
    address: new Address(agency),
  });

  if (epoch) {
    const response = await delegationContract.runQuery(provider, {
      func: new ContractFunction('getRewardData'),
      args: [BytesValue.fromHex(DecimalHexTwosComplement(epoch))],
    });
    if (response.returnCode.toString() === 'ok') {
      const agency_reward: Rewards = new Rewards();
      agency_reward.rewardDistributed = new BigNumber(
        hexToDec(Buffer.from(response.returnData[0], 'base64').toString('hex')),
      ).toFixed();

      agency_reward.totalActiveStake = new BigNumber(
        hexToDec(Buffer.from(response.returnData[1], 'base64').toString('hex')),
      ).toFixed();
      agency_reward.serviceFee = new BigNumber(
        hexToDec(Buffer.from(response.returnData[2], 'base64').toString('hex')),
      ).toFixed();

      agency_reward['epoch'] = epoch;
      agency_reward['staked'] = amount.toString();
      const ownerProfit = new BigNumber(agency_reward.serviceFee)
        .dividedBy(10000)
        .multipliedBy(new BigNumber(agency_reward.rewardDistributed));
      agency_reward['ownerProfit'] = NumberUtils.denominateFloat(
        ownerProfit.toFixed(),
      );
      const toBeDistributed = new BigNumber(
        agency_reward.rewardDistributed,
      ).minus(new BigNumber(ownerProfit));
      agency_reward['toBeDistributed'] = NumberUtils.denominateFloat(
        toBeDistributed.toString(),
      );
      let reward = new BigNumber(toBeDistributed).multipliedBy(
        new BigNumber(agency_reward['staked']),
      );

      reward = new BigNumber(reward).dividedBy(
        new BigNumber(agency_reward.totalActiveStake),
      );
      if (isOwner) {
        reward = reward.plus(
          ownerProfit.dividedBy(new BigNumber(Math.pow(10, 18))),
        );
      }
      agency_reward['APROwner'] = new BigNumber(agency_reward.rewardDistributed)
        .multipliedBy(36500)
        .dividedBy(new BigNumber(agency_reward.totalActiveStake))
        .toFixed();
      agency_reward['APRDelegator'] = new BigNumber(agency_reward['APROwner'])
        .minus(
          new BigNumber(agency_reward['APROwner']).multipliedBy(
            new BigNumber(agency_reward.serviceFee).dividedBy(10000),
          ),
        )
        .toFixed();
      agency_reward['rewardDistributed'] = NumberUtils.denominateFloat(
        agency_reward.rewardDistributed,
      );
      agency_reward['totalActiveStake'] = NumberUtils.denominateFloat(
        agency_reward.totalActiveStake.toString(),
      );
      agency_reward['reward'] = reward.toString();
      let pricePerEpoch: string;
      const timestamp = getTimestampByEpoch(epoch);
      if (epoch in epochPrice) {
        pricePerEpoch = epochPrice[epoch];
      } else {
        pricePerEpoch = (await getEpochTimePrice(epoch, timestamp, '')).price;
        epochPrice[epoch] = pricePerEpoch;
      }
      agency_reward['usdRewards'] = parseFloat(
        new BigNumber(pricePerEpoch).multipliedBy(reward).toFixed(),
      ).toFixed(2);
      agency_reward['usdRewardsToday'] = parseFloat(
        new BigNumber(todayPrice).multipliedBy(reward).toFixed(),
      ).toFixed(2);
      agency_reward['usdEpoch'] = parseFloat(pricePerEpoch);
      agency_reward['unix'] = timestamp * 1000;
      const date = new Date(getTimestampByEpoch(epoch) * 1000);
      agency_reward['date'] =
        '' +
        date.getDate() +
        '/' +
        (date.getMonth() + 1) +
        '/' +
        date.getFullYear();
      return agency_reward;
    } else {
      const timestamp = getTimestampByEpoch(epoch);
      const dateTime = new Date(timestamp * 1000);
      let pricePerEpoch = '';
      if (epoch in epochPrice) {
        pricePerEpoch = epochPrice[epoch];
      } else {
        pricePerEpoch = (await getEpochTimePrice(epoch, timestamp, '')).price;
        epochPrice[epoch] = pricePerEpoch;
      }
      return {
        staked: amount.toString(),
        reward: '0',
        usdEpoch: parseFloat(pricePerEpoch),
        unix: timestamp * 1000,
        usdRewardsToday: '0',
        date:
          '' +
          dateTime.getDate() +
          '/' +
          (dateTime.getMonth() + 1) +
          '/' +
          dateTime.getFullYear(),
        APRDelegator: '0',
        APROwner: '0',
        epoch,
        ownerProfit: '0',
        rewardDistributed: '0',
        usdRewards: '0',
        serviceFee: '0',
        toBeDistributed: '0',
        totalActiveStake: '0',
      };
    }
  }

  return new Rewards();
};

const isOwner = async (agency: string, address: string) => {
  const provider = new ProxyProvider('http://65.108.7.21:8079', {
    timeout: 20000,
  });
  const delegationContract = new SmartContract({
    address: new Address(agency),
  });
  let reply = false;
  const response = await delegationContract.runQuery(provider, {
    func: new ContractFunction('getContractConfig'),
    args: [],
  });
  if (response.returnCode.toString() === 'ok') {
    reply =
      AddressUtils.bech32Encode(
        Buffer.from(response.returnData[0], 'base64').toString('hex'),
      ) == address;
  } else {
    console.log(response);
  }
  return reply;
};
