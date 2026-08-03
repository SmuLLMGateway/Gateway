import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { BaseStatus } from '../../../../global/apiPayload/code/status.js';
import { ErrorStatus } from '../../../../global/apiPayload/code/status.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  SwaggerResultSchema,
} from '../../../../global/config/swagger.response.js';
import { PromptErrorStatus, PromptSuccessStatus } from '../../code/prompt.status.js';
import { PromptResDTO } from '../../dto/prompt.response.dto.js';

const tokenExpiredStatus = {
  httpStatus: HttpStatus.UNAUTHORIZED,
  code: 'AUTH401_1',
  message: '토큰이 만료되었습니다.',
} as const satisfies BaseStatus;

const analyzePendingStatus = {
  httpStatus: HttpStatus.OK,
  code: 'PROM200_2_1',
  message: '아직 분석이 진행 중입니다.',
} as const satisfies BaseStatus;

const llmPendingStatus = {
  httpStatus: HttpStatus.OK,
  code: 'PROM200_4_1',
  message: '아직 결과 생성 중입니다.',
} as const satisfies BaseStatus;

const maskingAnalysisMultipartBody = () =>
  ApiBody({
    schema: {
      type: 'object',
      required: ['json'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            '선택 파일(.pdf, .jpeg, .jpg, .png, 최대 10MB). '
            + '첨부하지 않을 때는 file 파트를 생략합니다.',
        },
        json: {
          type: 'string',
          description:
            '마스킹 요소 탐지 요청 JSON 문자열. llmModel, text, ticket은 필수이고 '
            + 'ner, recentTicket, chatRoomId는 생략하거나 null로 보낼 수 있습니다. '
            + 'ner를 생략하면 LPL의 첫 활성 NER Deployment를 사용합니다.',
          example:
            '{"llmModel":"Claude Sonnet 5",'
            + '"ner":"local-ner-gliner-multi",'
            + '"text":"다음 주 A사와 체결 예정인 미공개...",'
            + '"ticket":"a81cc17e-e10a-46ae-8113-dceffb932d6c"}',
        },
      },
    },
  });

const analyzeSuccessResponse = () =>
  ApiResponse({
    status: HttpStatus.OK,
    description:
      `${analyzePendingStatus.code}: ${analyzePendingStatus.message} / `
      + `${PromptSuccessStatus.ANALYZE.code}: ${PromptSuccessStatus.ANALYZE.message}`,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['isSuccess', 'code', 'message', 'result'],
          properties: {
            isSuccess: { type: 'boolean', example: true },
            code: {
              type: 'string',
              enum: [
                analyzePendingStatus.code,
                PromptSuccessStatus.ANALYZE.code,
              ],
            },
            message: {
              type: 'string',
              enum: [
                analyzePendingStatus.message,
                PromptSuccessStatus.ANALYZE.message,
              ],
            },
            result: {
              oneOf: [
                { $ref: getSchemaPath(PromptResDTO.Analyze) },
                { $ref: getSchemaPath(PromptResDTO.AnalyzeWithoutDetection) },
              ],
              nullable: true,
            },
          },
        },
        examples: {
          pending: {
            summary: '분석 처리 전',
            value: {
              isSuccess: true,
              code: analyzePendingStatus.code,
              message: analyzePendingStatus.message,
              result: null,
            },
          },
          completed: {
            summary: '마스킹 요소 탐지 완료',
            value: {
              isSuccess: true,
              code: PromptSuccessStatus.ANALYZE.code,
              message: PromptSuccessStatus.ANALYZE.message,
              result: {
                originText: '다음 주 A사와 체결 예정인...',
                recentDetectCnt: 3,
                masking: {
                  file: {
                    fileOriginalName: '[A사] 협력 파트너십 계약서.pdf',
                    fileUrl: 'http://local-llm...',
                    maskingCategory: '민감정보',
                    detectCnt: 2,
                  },
                  text: [
                    {
                      targetText: 'A사와 체결 예정인...',
                      startIdx: 6,
                      endIdx: 20,
                      maskingCategory: '민감정보',
                      detailCategory: '조달 및 계약 정보',
                    },
                  ],
                },
              },
            },
          },
          completedWithoutDetection: {
            summary: '탐지된 마스킹 요소 없음',
            value: {
              isSuccess: true,
              code: PromptSuccessStatus.ANALYZE.code,
              message: PromptSuccessStatus.ANALYZE.message,
              result: {
                recentDetectCnt: 0,
              },
            },
          },
        },
      },
    },
  });

const llmResultSuccessResponse = () =>
  ApiResponse({
    status: HttpStatus.OK,
    description:
      `${llmPendingStatus.code}: ${llmPendingStatus.message} / `
      + `${PromptSuccessStatus.LLM_RESPONSE.code}: `
      + PromptSuccessStatus.LLM_RESPONSE.message,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['isSuccess', 'code', 'message', 'result'],
          properties: {
            isSuccess: { type: 'boolean', example: true },
            code: {
              type: 'string',
              enum: [
                llmPendingStatus.code,
                PromptSuccessStatus.LLM_RESPONSE.code,
              ],
            },
            message: {
              type: 'string',
              enum: [
                llmPendingStatus.message,
                PromptSuccessStatus.LLM_RESPONSE.message,
              ],
            },
            result: {
              type: 'string',
              nullable: true,
              example: '다음은 다음 주 A사와 체결할 보고서 초안입니다...',
            },
          },
        },
        examples: {
          pending: {
            summary: 'LLM 결과 생성 전',
            value: {
              isSuccess: true,
              code: llmPendingStatus.code,
              message: llmPendingStatus.message,
              result: null,
            },
          },
          completed: {
            summary: 'LLM 결과 생성 완료',
            value: {
              isSuccess: true,
              code: PromptSuccessStatus.LLM_RESPONSE.code,
              message: PromptSuccessStatus.LLM_RESPONSE.message,
              result: '다음은 다음 주 A사와 체결할 보고서 초안입니다...',
            },
          },
        },
      },
    },
  });

const analyzeRequestErrors = () =>
  ApiErrorResponses([
    PromptErrorStatus.INVALID_FILE_FORM,
    PromptErrorStatus.DUPLICATED_TICKET,
    PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    PromptErrorStatus.NOT_FOUND_RECENT_TICKET,
    PromptErrorStatus.NOT_FOUND_CHAT_ROOM,
    tokenExpiredStatus,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

const llmSendErrors = () =>
  ApiErrorResponses([
    PromptErrorStatus.INVALID_FILE_FORM,
    PromptErrorStatus.DUPLICATED_TICKET,
    PromptErrorStatus.FORBIDDEN_LLM_MODEL,
    tokenExpiredStatus,
    ErrorStatus.INTERNAL_SERVER_ERROR,
  ]);

export const PromptControllerDocs = () =>
  applyDecorators(
    ApiTags('프롬프트'),
    ApiBearerAuth(),
    ApiExtraModels(
      PromptResDTO.AnalyzeRequest,
      PromptResDTO.Analyze,
      PromptResDTO.AnalyzeWithoutDetection,
      PromptResDTO.Masking,
      PromptResDTO.MaskingFile,
      PromptResDTO.MaskingText,
      PromptResDTO.PromptListFile,
      PromptResDTO.PromptListItem,
      PromptResDTO.PromptListPage,
      PromptResDTO.RecentPrompt,
      PromptResDTO.RecentAnalyze,
      PromptResDTO.NerDeployment,
      PromptResDTO.NerList,
    ),
  );

export const MaskingElementDetectionRequestDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '마스킹 요소 탐지 요청 (구현 중)',
      description:
        'multipart/form-data로 전송합니다. 각 프롬프트의 ticket은 새로운 UUID를 '
        + '사용합니다. recentTicket은 생략하거나 null로 보내면 이전 분석 요청 없이 '
        + '시작합니다. chatRoomId는 생략하거나 null로 보내면 새 채팅방을 생성하고, '
        + '응답 result.chatRoomId를 후속 요청에 사용합니다. 기존 채팅방을 사용할 때만 '
        + '소유한 chatRoomId(UUID)를 보냅니다. ner를 생략하면 첫 활성 NER Deployment를 사용합니다. '
        + 'llmModel이 활성 로컬 LLM과 연결되면 해당 Deployment를, 그렇지 않으면 첫 활성 로컬 LLM Deployment를 NER 서버에 전달합니다.',
    }),
    ApiConsumes('multipart/form-data'),
    maskingAnalysisMultipartBody(),
    ApiSuccessResponse(
      PromptSuccessStatus.PREPROMPT_REQUEST,
      SwaggerResultSchema.model(getSchemaPath(PromptResDTO.AnalyzeRequest)),
    ),
    ...analyzeRequestErrors(),
  );

export const AnalysisStatusCheckDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '분석 여부 확인',
      description:
        '마스킹 요소 탐지 요청 티켓으로 처리 상태와 결과를 조회합니다. '
        + 'startIdx는 탐지 시작 위치이고 endIdx는 탐지 문자열의 마지막 문자 '
        + '위치입니다. recentDetectCnt는 이번 분석에서 탐지된 전체 요소 수입니다. '
        + '처리 중에는 HTTP 200과 PROM200_2_1을 반환합니다.',
    }),
    ApiQuery({
      name: 'ticket',
      required: true,
      type: String,
      format: 'uuid',
      description: '마스킹 요소 탐지 요청 티켓',
      example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
    }),
    analyzeSuccessResponse(),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_ANAL_REQ,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const CancelAnalyzeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '분석 취소',
      description:
        '현재 사용자가 요청한 마스킹 요소 탐지 요청을 ticket으로 취소합니다. '
        + '해당 사용자의 MASKING 프롬프트 로그를 제거하고 리포트 상태를 CANCEL로 변경합니다.',
    }),
    ApiQuery({
      name: 'ticket',
      required: true,
      type: String,
      format: 'uuid',
      description: '취소할 마스킹 요소 탐지 요청 티켓',
      example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.CANCEL_ANALYZE,
      SwaggerResultSchema.null(),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_ANAL_REQ,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const LlmSendDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'LLM 전송',
      description:
        '마스킹 요소 탐지 요청을 생성한 사용자만 분석 완료 ticket으로 LLM 전송을 요청할 수 있습니다. '
        + '저장된 텍스트 마스킹 결과를 원문에 치환한 뒤 Provider로 전송하며, 요청은 즉시 반환되고 Provider 호출은 백그라운드에서 처리됩니다.',
    }),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        required: ['ticket'],
        properties: {
          ticket: {
            type: 'string',
            format: 'uuid',
            description: '마스킹 요소 탐지 요청에 사용한 티켓',
            example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
          },
        },
      },
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.LLM_REQUEST,
      SwaggerResultSchema.null(),
    ),
    ...llmSendErrors(),
  );

export const LlmResultCheckDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'LLM 결과 확인',
      description:
        '마스킹 요소 탐지 요청을 생성한 사용자만 ticket으로 생성 상태와 결과를 조회할 수 있습니다.',
    }),
    ApiQuery({
      name: 'ticket',
      required: true,
      type: String,
      format: 'uuid',
      description: '마스킹 요소 탐지 요청 티켓',
      example: 'a81cc17e-e10a-46ae-8113-dceffb932d6c',
    }),
    llmResultSuccessResponse(),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_PROMPT,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const ChatRoomListDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '채팅방 목록 조회',
      description:
        '최근 대화한 채팅방을 최대 10개 조회합니다. 10개 미만이면 모든 '
        + '채팅방을 반환하고 과거 기록이 없으면 result는 null입니다.',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.RECENT_PROMPT_LIST,
      SwaggerResultSchema.array(getSchemaPath(PromptResDTO.RecentPrompt), true),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_CHAT_ROOM,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const ModelListDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '모델 목록 조회',
      description: '사용자의 부서에서 사용할 수 있는 외부 LLM 모델과, '
        + 'LPL의 활성 Deployment에서 동기화된 local-* 로컬 LLM 모델 목록을 조회합니다. '
        + '동기화된 로컬 모델은 모든 부서에서 사용할 수 있습니다.',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.MODEL_LIST,
      {
        type: 'array',
        items: {
          type: 'string',
          example: 'local-Qwen2.5-7B-Instruct',
        },
      },
    ),
    ...ApiErrorResponses([
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const NerListDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '로컬 NER 목록 조회',
      description:
        '로그인한 모든 사용자가 LPL Provider의 GET /deployments/ner 결과를 조회합니다. '
        + 'LPL 목록의 deployments 배열을 활성화 여부 필터링 없이 그대로 반환합니다.',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.NER_LIST,
      SwaggerResultSchema.model(getSchemaPath(PromptResDTO.NerList)),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NER_DEPLOYMENT_LIST_UNAVAILABLE,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const RecentMaskingElementDetectionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '직전 마스킹 요소 탐지 요청 조회',
      description:
        '채팅방의 가장 최근 마스킹 요소 탐지 요청과 그 분석 결과를 조회합니다. '
        + 'startIdx는 탐지 시작 위치이고 endIdx는 탐지 문자열의 마지막 문자 '
        + '위치입니다.',
    }),
    ApiParam({
      name: 'chatRoomId',
      required: true,
      type: String,
      format: 'uuid',
      description: '조회할 채팅방 ID',
      example: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.RECENT_ANALYZE,
      SwaggerResultSchema.model(getSchemaPath(PromptResDTO.RecentAnalyze)),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_RECENT_ANALYZE,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const PromptListDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '프롬프트 조회',
      description:
        '채팅방의 완료된 프롬프트 로그를 최신순으로 조회합니다. '
        + 'cursor에는 직전 응답의 nextCursor(UNIX timestamp ms)를 전달합니다. '
        + '프롬프트가 없으면 result는 null입니다.',
    }),
    ApiParam({
      name: 'chatRoomId',
      required: true,
      type: String,
      format: 'uuid',
      description: '조회할 채팅방 ID',
      example: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: '최신순 페이지네이션 커서(UNIX timestamp ms). 생략하거나 null이면 첫 페이지를 조회합니다.',
      example: '1784957118000',
    }),
    ApiQuery({
      name: 'pageSize',
      required: true,
      type: Number,
      description: '불러올 데이터 수(1~100)',
      example: 10,
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.PROMPT_LIST,
      SwaggerResultSchema.model(getSchemaPath(PromptResDTO.PromptListPage), true),
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.INVALID_PROMPT_LIST_REQUEST,
      PromptErrorStatus.NOT_FOUND_CHAT_ROOM,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const FileDownloadDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '파일 다운로드',
      description:
        'Query Parameter로 전달한 분석 결과의 fileUrl을 이용해 파일 다운로드 '
        + 'URL을 조회합니다.',
    }),
    ApiQuery({
      name: 'fileUrl',
      required: true,
      type: String,
      description: '분석 결과에서 반환된 파일 URL',
      example:
        's3://gateway-private/masking/a81cc17e-e10a-46ae-8113-dceffb932d6c/source',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.FILE_DOWNLOAD,
      {
        type: 'string',
        format: 'uri',
        example: 'https://minio.example.com/gateway-private/...',
      },
    ),
    ...ApiErrorResponses([
      PromptErrorStatus.NOT_FOUND_FILE,
      PromptErrorStatus.FORBIDDEN_FILE_DOWNLOAD,
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
