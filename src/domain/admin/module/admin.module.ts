import { Module } from '@nestjs/common';
import { AdminController } from '../controller/admin.controller.js';
import { AdminService } from '../service/admin.service.js';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
