import {
  CacheModuleOptions,
  CacheOptionsFactory,
  Injectable,
} from '@nestjs/common';
import { CachingService } from './caching.service';

@Injectable()
export class CacheConfigService implements CacheOptionsFactory {
  constructor(private readonly cachingService: CachingService) {}

  async createCacheOptions(): Promise<CacheModuleOptions> {
    const ttl = await this.cachingService.getSecondsRemainingUntilNextRound();

    return {
      ttl,
    };
  }
}
