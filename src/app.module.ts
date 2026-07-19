import { Module } from '@nestjs/common';
import { AdminModule } from './domain/admin/module/admin.module.js';
import { AuthModule } from './domain/auth/module/auth.module.js';
import { PromptModule } from './domain/prompt/module/prompt.module.js';
import { UserModule } from './domain/user/module/user.module.js';

@Module({
  // 다른 도메인의 모듈(예: UserModule, ProductModule 등)이 생기면 여기에 계속 추가합니다!
  imports: [AuthModule, PromptModule, UserModule, AdminModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
