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
import { LlmModule } from '../../../global/llm/module/llm.module.js';
import { MemberDepartmentDAO } from '../../user/dao/member-department.dao.js';
import { LlmDetailModelDAO } from '../dao/llm-detail-model.dao.js';
import { MemberDAO } from '../../user/dao/member.dao.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActiveApiKeyDAO,
      AdminLogDAO,
      DepartmentDAO,
      LlmDetailModelDAO,
      MemberDAO,
      MemberDepartmentDAO,
      PolicyDAO,
    ]),
    UserModule,
    SecurityModule,
    LlmModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminMapper],
})
export class AdminModule {}
