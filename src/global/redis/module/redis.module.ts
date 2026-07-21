import { Module } from '@nestjs/common';
import { RedisConfig } from '../config/redis.config.js';
import { RedisService } from '../service/redis.service.js';

@Module({
  providers: [RedisConfig, RedisService],
  exports: [RedisService],
})
export class RedisModule {}
