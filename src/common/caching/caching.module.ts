import { forwardRef, Global, Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { MicroserviceModule } from "../microservice/microservice.module";
import { ProtocolModule } from "../protocol/protocol.module";
import { CacheConfigService } from "./cache.config.service";
import { CachingService } from "./caching.service";
import { LocalCacheService } from "./local.cache.service";

@Global()
@Module({
  imports: [
    forwardRef(() => ProtocolModule),
    MetricsModule,
    forwardRef(() => MicroserviceModule),
  ],
  providers: [
    CachingService, CacheConfigService, LocalCacheService,
  ],
  exports: [
    CachingService, CacheConfigService,
  ],
})
export class CachingModule { }
