import { Module } from '@nestjs/common';
import { NerClient } from '../client/ner.client.js';
import { NerConfig } from '../config/ner.config.js';

@Module({
  providers: [NerClient, NerConfig],
  exports: [NerClient, NerConfig],
})
export class NerModule {}
