import { Module } from "@nestjs/common";
import { AuthController } from "../controller/auth.controller.js";
import { AuthService } from "../service/auth.service.js";
import { SecurityModule } from "../../../global/security/module/security.module.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MemberDAO } from "../../user/dao/member.dao.js";

@Module({
  imports: [SecurityModule, TypeOrmModule.forFeature([MemberDAO])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
