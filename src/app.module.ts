import { Module } from '@nestjs/common';
import { TestModule } from './domain/test/module/test.module.js';

@Module({
  // 다른 도메인의 모듈(예: UserModule, ProductModule 등)이 생기면 여기에 계속 추가합니다!
  imports: [TestModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
