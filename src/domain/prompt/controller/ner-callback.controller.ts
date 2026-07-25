import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { GeneralResponse } from '../../../global/apiPayload/general.response.js';
import { Public } from '../../../global/security/decorator/public.decorator.js';
import { PromptSuccessStatus } from '../code/prompt.status.js';
import { NerCallbackRequestDTO } from '../dto/ner-callback.request.dto.js';
import { NerCallbackGuard } from '../guard/ner-callback.guard.js';
import { ParseNerCallbackPipe } from '../pipe/parse-ner-callback.pipe.js';
import { PromptService } from '../service/prompt.service.js';
import {
  NerCallbackControllerDocs,
  NerCallbackDocs,
} from './docs/ner-callback.controller.docs.js';

@Public()
@NerCallbackControllerDocs()
@Controller('/internal/v1/ner')
export class NerCallbackController {
  constructor(private readonly promptService: PromptService) {}

  @NerCallbackDocs()
  @Post('/callback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(NerCallbackGuard)
  async callback(
    @Body(ParseNerCallbackPipe) dto: NerCallbackRequestDTO,
  ): Promise<GeneralResponse<null>> {
    const result = await this.promptService.applyNerResult(dto);
    return GeneralResponse.onSuccess(PromptSuccessStatus.NER_CALLBACK, result);
  }
}
