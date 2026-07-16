import { Module } from '@nestjs/common';
import { TestController } from '../controller/test.controller.js';
import { TestService } from '../service/test.service.js';

@Module({
  imports: [],
  controllers: [TestController],
  providers: [TestService],
})
export class TestModule {}
