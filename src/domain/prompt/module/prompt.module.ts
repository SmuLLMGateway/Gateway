import { Module } from '@nestjs/common';
import { PromptController } from '../controller/prompt.controller.js';
import { PromptService } from '../service/prompt.service.js';

@Module({
  controllers: [PromptController],
  providers: [PromptService],
})
export class PromptModule {}
