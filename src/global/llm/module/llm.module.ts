import { Module } from '@nestjs/common';
import { LlmApiKeyValidationClient } from '../client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationConfig } from '../config/llm-api-key-validation.config.js';
import { ApiKeyEncryptionService } from '../service/api-key-encryption.service.js';

@Module({
  providers: [
    ApiKeyEncryptionService,
    LlmApiKeyValidationConfig,
    LlmApiKeyValidationClient,
  ],
  exports: [
    ApiKeyEncryptionService,
    LlmApiKeyValidationConfig,
    LlmApiKeyValidationClient,
  ],
})
export class LlmModule {}
