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
import { ActiveLlmDAO } from '../dao/active-llm.dao.js';
import { LlmDetailModelDAO } from '../dao/llm-detail-model.dao.js';
import { MemberDAO } from '../../user/dao/member.dao.js';
import { DepartmentPolicyDAO } from '../dao/department-policy.dao.js';
import { MemberLimitDAO } from '../../user/dao/member-limit.dao.js';
import { PresetDAO } from '../dao/preset.dao.js';
import { PresetPolicyDAO } from '../dao/preset-policy.dao.js';
import { HealthHistoryDAO } from '../dao/health-history.dao.js';
import { ObjectStorageModule } from '../../../global/storage/module/object-storage.module.js';
import { SystemHealthMonitorService } from '../service/system-health-monitor.service.js';
import { NerModule } from '../../../global/ner/module/ner.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActiveApiKeyDAO,
      ActiveLlmDAO,
      AdminLogDAO,
      DepartmentDAO,
      DepartmentPolicyDAO,
      HealthHistoryDAO,
      LlmDetailModelDAO,
      MemberDAO,
      MemberDepartmentDAO,
      MemberLimitDAO,
      PolicyDAO,
      PresetDAO,
      PresetPolicyDAO,
    ]),
    UserModule,
    SecurityModule,
    LlmModule,
    NerModule,
    ObjectStorageModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminMapper, SystemHealthMonitorService],
})
export class AdminModule {}
