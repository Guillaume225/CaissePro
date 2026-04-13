import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * In-memory fallback that mimics the subset of ioredis used in this service.
 * Used automatically when a real Redis server is unreachable (dev mode).
 */
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private logger = new Logger('InMemoryRedis');

  constructor() {
    this.logger.warn('Using in-memory Redis fallback – data is NOT persisted');
  }

  private isExpired(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return true;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null;
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    let ttlMs: number | undefined;
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      ttlMs = args[1] * 1000;
    }
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (parseInt(current || '0', 10) + 1).toString();
    const entry = this.store.get(key);
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt });
    return parseInt(next, 10);
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$',
    );
    const result: string[] = [];
    for (const key of this.store.keys()) {
      if (!this.isExpired(key) && regex.test(key)) result.push(key);
    }
    return result;
  }

  multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const chain = {
      incr: (key: string) => { ops.push(() => this.incr(key)); return chain; },
      expire: (key: string, sec: number) => { ops.push(() => this.expire(key, sec)); return chain; },
      exec: async () => {
        const results: Array<[null, unknown]> = [];
        for (const op of ops) results.push([null, await op()]);
        return results;
      },
    };
    return chain;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const host = config.get('redis.host') || 'localhost';
        const port = config.get('redis.port') || 6379;

        try {
          const redis = new Redis({
            host,
            port,
            password: config.get('redis.password') || undefined,
            retryStrategy: () => null, // don't retry during probe
            lazyConnect: true,
            connectTimeout: 3000,
          });
          await redis.connect();
          logger.log(`Connected to Redis at ${host}:${port}`);
          // Reconfigure retry for runtime
          redis.options.retryStrategy = (times: number) => Math.min(times * 50, 2000);
          return redis;
        } catch {
          logger.warn(`Cannot connect to Redis at ${host}:${port} – using in-memory fallback`);
          return new InMemoryRedis() as unknown as Redis;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy() {
    // Redis client cleanup happens via NestJS lifecycle
  }
}
