import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get('redis.host'),
          port: config.get('redis.port'),
          password: config.get('redis.password') || undefined,
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        client.on('error', (err) => {
          console.warn('[Redis] connection error (non-fatal):', err.message);
        });
        client.connect().catch(() => {});
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  async onModuleDestroy() {}
}
