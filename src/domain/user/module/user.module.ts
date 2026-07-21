import { Module } from '@nestjs/common';
import { UserController } from '../controller/user.controller.js';
import { UserService } from '../service/user.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberDAO } from '../dao/member.dao.js';
import { MemberDepartmentDAO } from '../dao/member-department.dao.js';
import { MemberLimitDAO } from '../dao/member-limit.dao.js';
import { UserMapper } from '../mapper/user.mapper.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemberDAO, MemberDepartmentDAO, MemberLimitDAO]),
  ],
  controllers: [UserController],
  providers: [UserService, UserMapper],
  exports: [UserMapper],
})
export class UserModule {}
