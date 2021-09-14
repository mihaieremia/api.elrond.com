import { TransactionOperationAction } from './transaction.operation.action';
import { TransactionOperationType } from './transaction.operation.type';

export class TransactionOperation {
  action: TransactionOperationAction = TransactionOperationAction.none;

  type: TransactionOperationType = TransactionOperationType.none;

  identifier = '';

  collection?: string;

  value = '';

  sender = '';

  receiver = '';
}
