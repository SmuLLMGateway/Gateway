import { Module } from '@nestjs/common';
import { PromptController } from '../controller/prompt.controller.js';
import { PromptService } from '../service/prompt.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptLogDAO } from '../dao/prompt-log.dao.js';
import { PromptMaskingDAO } from '../dao/prompt-masking.dao.js';
import { PromptRoomDAO } from '../dao/prompt-room.dao.js';
import { PromptMapper } from '../mapper/prompt.mapper.js';
import { RedisModule } from '../../../global/redis/module/redis.module.js';
import { AnalyzeTicketConfig } from '../config/analyze-ticket.config.js';
import { NerConfig } from '../config/ner.config.js';
import { AnalyzeTicketRepository } from '../repository/analyze-ticket.repository.js';
import { NerClient } from '../client/ner.client.js';
import { RegexMaskingDetectorService } from '../service/regex-masking-detector.service.js';
import { PromptFileValidatorService } from '../service/prompt-file-validator.service.js';
import { ParsePrePromptJsonPipe } from '../pipe/parse-pre-prompt-json.pipe.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptLogDAO, PromptMaskingDAO, PromptRoomDAO]),
    RedisModule,
  ],
  controllers: [PromptController],
  providers: [
    PromptService,
    PromptMapper,
    AnalyzeTicketConfig,
    NerConfig,
    AnalyzeTicketRepository,
    NerClient,
    RegexMaskingDetectorService,
    PromptFileValidatorService,
    ParsePrePromptJsonPipe,
  ],
})
export class PromptModule {}
