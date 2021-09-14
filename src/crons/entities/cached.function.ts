import { InvalidationFunction } from './invalidation.function';

export class CachedFunction {
  funcName = '';
  invalidations: InvalidationFunction[] = [];
}
