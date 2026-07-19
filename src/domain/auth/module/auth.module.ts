import { Module } from "@nestjs/common";
import { AuthController } from "../controller/auth.controller.js";
import { AuthService } from "../service/auth.service.js";

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}