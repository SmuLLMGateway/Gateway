import { Module } from '@nestjs/common';
import { ActiveApiKeyServiceTypeMigrationService } from '../service/active-api-key-service-type-migration.service.js';
import { MasterDataSeedService } from '../service/master-data-seed.service.js';
import { NerModule } from '../../ner/module/ner.module.js';

@Module({
  imports: [NerModule],
  providers: [
    ActiveApiKeyServiceTypeMigrationService,
    MasterDataSeedService,
  ],
})
export class MasterDataSeedModule {}
