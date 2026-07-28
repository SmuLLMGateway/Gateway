import { Module } from '@nestjs/common';
import { ActiveApiKeyServiceTypeMigrationService } from '../service/active-api-key-service-type-migration.service.js';
import { MasterDataSeedService } from '../service/master-data-seed.service.js';

@Module({
  providers: [
    ActiveApiKeyServiceTypeMigrationService,
    MasterDataSeedService,
  ],
})
export class MasterDataSeedModule {}
