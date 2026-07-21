import { Module } from '@nestjs/common';
import { AdminController } from '../controller/admin.controller.js';
import { AdminService } from '../service/admin.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveApiKeyDAO } from '../dao/active-api-key.dao.js';
import { AdminLogDAO } from '../dao/admin-log.dao.js';
import { DepartmentDAO } from '../dao/department.dao.js';
import { PolicyDAO } from '../dao/policy.dao.js';
import { AdminMapper } from '../mapper/admin.mapper.js';
import { UserModule } from '../../user/module/user.module.js';
import { SecurityModule } from '../../../global/security/module/security.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActiveApiKeyDAO,
      AdminLogDAO,
      DepartmentDAO,
      PolicyDAO,
    ]),
    UserModule,
    SecurityModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminMapper],
})
export class AdminModule {}
