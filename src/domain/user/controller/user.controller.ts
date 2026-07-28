import { Controller, Get, Query } from '@nestjs/common';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { UserSuccessStatus } from '../code/user.status.js';
import { UserReqDTO } from '../dto/user.request.dto.js';
import { UserResDTO } from '../dto/user.response.dto.js';
import { UserService } from '../service/user.service.js';
import {
  MessageHistoryDocs,
  MessageHistorySummaryDocs,
  UserInfoDocs,
  UserControllerDocs,
} from './docs/user.controller.docs.js';
import { CurrentUser } from '../../../global/security/decorator/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../global/security/type/jwt-payload.type.js';

@UserControllerDocs()
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UserInfoDocs()
  @Get('/api/v1/users/me')
  async getUserInfo(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<UserResDTO.UserInfo>> {
    const result = await this.userService.getUserInfo(authentication);
    return GeneralResponse.onSuccess(UserSuccessStatus.USER_INFO, result);
  }

  @MessageHistorySummaryDocs()
  @Get('/api/v1/message-summary')
  async getMessageHistorySummary(
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<
    GeneralResponse<UserResDTO.MessageSummary>
  > {
    const result = await this.userService.getMessageSummary(authentication);
    return GeneralResponse.onSuccess(UserSuccessStatus.MESSAGE_SUMMARY, result);
  }

  @MessageHistoryDocs()
  @Get('/api/v1/messages')
  async getMessageHistory(
    @Query() dto: UserReqDTO.MessageList,
    @CurrentUser() authentication: AuthenticatedUser,
  ): Promise<GeneralResponse<UserResDTO.MessageList>> {
    const result = await this.userService.getMessages(dto, authentication);
    return GeneralResponse.onSuccess(UserSuccessStatus.MESSAGE_LIST, result);
  }
}
