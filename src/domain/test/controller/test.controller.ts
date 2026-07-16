import { Controller, Get, Query } from '@nestjs/common';
import { TestService } from '../service/test.service.js';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { TestSuccessStatus, TestErrorStatus } from '../code/test.status.js';
import { TestException } from '../exception/test.exception.js';
import { TestControllerDocs, GetHelloDocs, GetExceptionDocs } from './docs/test.controller.docs.js';

@TestControllerDocs()
@Controller()
export class TestController {
  constructor(private readonly testService: TestService) { }

  @GetHelloDocs()
  @Get('/test')
  async getHello(
    @Query('message') message: string
  ): Promise<GeneralResponse<string>> {
    const result = await this.testService.getHello(message);
    return GeneralResponse.onSuccess(TestSuccessStatus.TEST_OK, result)
  }

  @GetExceptionDocs()
  @Get('/exception')
  async getException() {
    throw new TestException(TestErrorStatus.TEST_ERROR)
  }
}
