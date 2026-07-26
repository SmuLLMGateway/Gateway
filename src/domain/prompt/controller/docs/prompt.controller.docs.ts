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
          description: '마스킹 요소 탐지 요청 JSON 문자열',
          example:
            '{"model":"Claude Sonnet 5",'
            + '"text":"다음 주 A사와 체결 예정인 미공개...",'
            + '"ticket":"a81cc17e-e10a-46ae-8113-dceffb932d6c",'
            + '"recentTicket":"8e88c068-722e-4c04-93c5-906cea400be2",'
            + '"chatRoomId":"840c66ce-0b5d-4663-bc63-b4c4666cd0f5"}',
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
              allOf: [{ $ref: getSchemaPath(PromptResDTO.Analyze) }],
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
                      endIdx: 21,
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
              result: null,
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
      PromptResDTO.Analyze,
      PromptResDTO.Masking,
      PromptResDTO.MaskingFile,
      PromptResDTO.MaskingText,
      PromptResDTO.PromptListFile,
      PromptResDTO.PromptListItem,
      PromptResDTO.PromptListPage,
      PromptResDTO.RecentPrompt,
      PromptResDTO.RecentAnalyze,
    ),
  );

export const MaskingElementDetectionRequestDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '마스킹 요소 탐지 요청 (구현 중)',
      description:
        'multipart/form-data로 전송합니다. 각 프롬프트의 ticket은 새로운 UUID를 '
        + '사용하고 같은 채팅방에서는 chatRoomId를 유지합니다. 첫 요청의 '
        + 'recentTicket은 null입니다. 현재 NER 서버 실제 호출은 비활성화되어 있습니다.',
    }),
    ApiConsumes('multipart/form-data'),
    maskingAnalysisMultipartBody(),
    ApiSuccessResponse(
      PromptSuccessStatus.PREPROMPT_REQUEST,
      SwaggerResultSchema.null(),
    ),
    ...analyzeRequestErrors(),
  );

export const AnalysisStatusCheckDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '분석 여부 확인 (구현 중)',
      description:
        '마스킹 요소 탐지 요청 티켓으로 처리 상태와 결과를 조회합니다. '
        + 'startIdx는 탐지 시작 위치이고 endIdx는 탐지 문자열의 마지막 문자 '
        + '다음 위치입니다. 처리 중에는 HTTP 200과 PROM200_2_1을 반환합니다.',
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

export const LlmSendDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'LLM 전송 (구현 중)',
      description:
        '마스킹 요소 탐지 요청과 분석 여부 확인을 마친 뒤 같은 ticket으로 '
        + 'LLM 전송을 요청합니다. 프롬프트를 수정했다면 마스킹 요소 탐지 요청부터 '
        + '다시 수행해야 합니다. 현재 실제 LLM 전송 비즈니스 로직은 구현되지 않았습니다.',
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
      summary: 'LLM 결과 확인 (구현 중)',
      description:
        '마스킹 요소 탐지 요청에 사용한 ticket으로 LLM 결과 생성 상태와 결과를 '
        + '조회합니다. 현재 결과 조회 비즈니스 로직은 구현되지 않아 생성 중 응답을 '
        + '반환합니다.',
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
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const ModelListDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '모델 목록 조회 (구현 중)',
      description: '사용자의 부서에서 사용할 수 있는 LLM 모델 목록을 조회합니다.',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.MODEL_LIST,
      {
        type: 'array',
        items: {
          type: 'string',
          example: 'Claude Sonnet 5',
        },
      },
    ),
    ...ApiErrorResponses([
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const RecentMaskingElementDetectionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '직전 마스킹 요소 탐지 요청 조회 (구현 중)',
      description:
        '채팅방의 가장 최근 마스킹 요소 탐지 요청과 그 분석 결과를 조회합니다. '
        + 'startIdx는 탐지 시작 위치이고 endIdx는 탐지 문자열의 마지막 문자 '
        + '다음 위치입니다.',
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
      summary: '프롬프트 조회 (구현 중)',
      description:
        '채팅방의 프롬프트를 최신순으로 조회합니다. cursor는 UNIX timestamp '
        + '밀리초 형식이며, 프롬프트가 없으면 result는 null입니다. 현재 조회 '
        + '비즈니스 로직은 구현되지 않았습니다.',
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
      description: '최신순 페이지네이션 커서(UNIX timestamp ms)',
      example: '1784957118000',
    }),
    ApiQuery({
      name: 'pageSize',
      required: true,
      type: Number,
      description: '불러올 데이터 수',
      example: 10,
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.PROMPT_LIST,
      SwaggerResultSchema.model(
        getSchemaPath(PromptResDTO.PromptListPage),
        true,
      ),
    ),
    ...ApiErrorResponses([
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );

export const FileDownloadDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '파일 다운로드 (구현 중)',
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

export const ConversationSearchDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: '대화 검색 (구현 중)',
      description:
        '검색 키워드로 채팅 내역을 조회합니다. 검색 결과 응답 구조는 아직 '
        + '명세에서 확정되지 않았으며 현재 구현은 항상 null을 반환합니다.',
    }),
    ApiQuery({
      name: 'query',
      required: true,
      type: String,
      description: '검색 키워드',
      example: '계약 보고서',
    }),
    ApiSuccessResponse(
      PromptSuccessStatus.SEARCH_PROMPT,
      SwaggerResultSchema.unknown(),
    ),
    ...ApiErrorResponses([
      tokenExpiredStatus,
      ErrorStatus.INTERNAL_SERVER_ERROR,
    ]),
  );
