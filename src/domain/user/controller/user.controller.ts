import { Controller, Get, Query } from '@nestjs/common';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { UserSuccessStatus } from '../code/user.status.js';
import { UserReqDTO } from '../dto/user.request.dto.js';
import { UserResDTO } from '../dto/user.response.dto.js';
import { UserService } from '../service/user.service.js';
import {
  MessageListDocs,
  MessageSummaryDocs,
  UserControllerDocs,
} from './docs/user.controller.docs.js';

@UserControllerDocs()
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessageSummaryDocs()
  @Get('/api/v1/message-summary')
  async getMessageSummary(): Promise<GeneralResponse<UserResDTO.MessageSummary>> {
    const result = await this.userService.getMessageSummary();
    return GeneralResponse.onSuccess(UserSuccessStatus.MESSAGE_SUMMARY, result);
  }

  @MessageListDocs()
  @Get('/api/v1/messages')
  async getMessages(
    @Query() dto: UserReqDTO.MessageList,
  ): Promise<GeneralResponse<UserResDTO.MessageList>> {
    const result = await this.userService.getMessages(dto);
    return GeneralResponse.onSuccess(UserSuccessStatus.MESSAGE_LIST, result);
  }
}
