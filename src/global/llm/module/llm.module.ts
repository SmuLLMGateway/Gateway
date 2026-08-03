import { Module } from '@nestjs/common';
import { LlmApiKeyValidationClient } from '../client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationConfig } from '../config/llm-api-key-validation.config.js';
import { ApiKeyEncryptionService } from '../service/api-key-encryption.service.js';
import { ProviderConfig } from '../config/provider.config.js';
import { ProviderClient } from '../client/provider.client.js';

@Module({
  providers: [
    ApiKeyEncryptionService,
    LlmApiKeyValidationConfig,
    LlmApiKeyValidationClient,
    ProviderConfig,
    ProviderClient,
  ],
  exports: [
    ApiKeyEncryptionService,
    LlmApiKeyValidationConfig,
    LlmApiKeyValidationClient,
    ProviderConfig,
    ProviderClient,
  ],
})
export class LlmModule {}
