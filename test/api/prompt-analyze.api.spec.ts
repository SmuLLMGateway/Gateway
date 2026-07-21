import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NerClient } from '../../src/domain/prompt/client/ner.client.js';
import { NerConfig } from '../../src/domain/prompt/config/ner.config.js';
import { PromptController } from '../../src/domain/prompt/controller/prompt.controller.js';
import type { PromptResDTO } from '../../src/domain/prompt/dto/prompt.response.dto.js';
import { ParsePrePromptJsonPipe } from '../../src/domain/prompt/pipe/parse-pre-prompt-json.pipe.js';
import { AnalyzeTicketRepository } from '../../src/domain/prompt/repository/analyze-ticket.repository.js';
import { PromptFileValidatorService } from '../../src/domain/prompt/service/prompt-file-validator.service.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { RegexMaskingDetectorService } from '../../src/domain/prompt/service/regex-masking-detector.service.js';
import {
  GatewayExceptionFilter,
  GlobalExceptionFilter,
  HttpExceptionFilter,
} from '../../src/global/apiPayload/handler/exception.filter.js';
import { ResponseInterceptor } from '../../src/global/apiPayload/interceptors/response.interceptor.js';
import { AccessTokenGuard } from '../../src/global/security/guard/access-token.guard.js';
import { RolesGuard } from '../../src/global/security/guard/roles.guard.js';
import { JwtTokenService } from '../../src/global/security/service/jwt-token.service.js';
import { SecurityPrincipalService } from '../../src/global/security/service/security-principal.service.js';
import type {
  AuthenticatedUser,
  VerifiedAccessToken,
} from '../../src/global/security/type/jwt-payload.type.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';

describe('마스킹 요소 탐지 요청 HTTP API', () => {
  const ticket = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const authentication: AuthenticatedUser = {
    userId: 42,
    role: UserRole.USER,
    expiredAt: '2026-07-21T12:00:00.000Z',
    accessToken: true,
  };
  const dto = {
    model: 'Claude Sonnet 5',
    text: [
      '전화번호 010-1234-5678',
      '주민번호 900101-1234567',
      '카드번호 4111 1111 1111 1111',
      '이메일 member@example.com',
      'api_key=AbCdEfGhIjKlMnOp1234',
    ].join(', '),
    ticket,
  };

  const tokenService = {
    verifyAccessToken: jest.fn(),
  };
  const principalService = {
    getAuthenticatedUser: jest.fn(),
  };
  const ticketRepository = {
    createFingerprint: jest.fn(),
    acquire: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };

  let app: INestApplication;
  let regexDetector: RegexMaskingDetectorService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PromptController],
      providers: [
        PromptService,
        RegexMaskingDetectorService,
        PromptFileValidatorService,
        ParsePrePromptJsonPipe,
        NerClient,
        Reflector,
        AccessTokenGuard,
        RolesGuard,
        {
          provide: NerConfig,
          useValue: {
            analyzeUrl: 'http://ner.internal/analyze',
            timeoutMs: 1_000,
            apiKey: undefined,
          },
        },
        { provide: AnalyzeTicketRepository, useValue: ticketRepository },
        { provide: JwtTokenService, useValue: tokenService },
        { provide: SecurityPrincipalService, useValue: principalService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(
      moduleRef.get(AccessTokenGuard),
      moduleRef.get(RolesGuard),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter(),
      new HttpExceptionFilter(),
      new GatewayExceptionFilter(),
    );
    regexDetector = moduleRef.get(RegexMaskingDetectorService);
    await app.init();
  });

  beforeEach(() => {
    resetMocks();

    tokenService.verifyAccessToken.mockResolvedValue({
      userId: authentication.userId,
      expiredAt: authentication.expiredAt,
      accessToken: true,
    } satisfies VerifiedAccessToken);
    principalService.getAuthenticatedUser.mockResolvedValue(authentication);
    ticketRepository.createFingerprint.mockReturnValue('request-fingerprint');
    ticketRepository.acquire.mockResolvedValue({
      type: 'ACQUIRED',
      operationId: 'operation-id',
    });
    ticketRepository.complete.mockResolvedValue(true);
    ticketRepository.fail.mockResolvedValue(true);

    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        fileObjectId: 52,
        maskingCategory: '개인정보',
        detectCnt: 2,
      }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('원본 텍스트에서 다섯 종류를 탐지하고 PROM200_1을 반환한다', async () => {
    const response = await postAnalyze(JSON.stringify(dto)).expect(200);

    expect(ticketRepository.createFingerprint).toHaveBeenCalledWith(
      dto.model,
      dto.text,
      undefined,
    );
    expect(ticketRepository.acquire).toHaveBeenCalledWith(
      authentication.userId,
      ticket,
      'request-fingerprint',
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    const completedResult = ticketRepository.complete.mock.calls[0]?.[4] as
      | PromptResDTO.Analyze
      | undefined;
    expect(completedResult?.originText).toBe(dto.text);
    expect(completedResult?.masking.file).toBeNull();
    expect(
      completedResult?.masking.text.map((item) => item.detailCategory),
    ).toEqual([
      '전화번호',
      '주민등록번호',
      '카드번호',
      '이메일',
      'API Key',
    ]);
    expect(
      completedResult?.masking.text.every(
        (item) => dto.text.slice(item.startIdx, item.endIdx) === item.targetText,
      ),
    ).toBe(true);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_1',
      message: '성공적으로 마스킹 요소 분석을 요청했습니다.',
      result: null,
    });
  });

  it('업로드 파일을 NER 서버에 multipart로 전달하고 결과를 저장한다', async () => {
    const file = Buffer.from('%PDF-1.7\nmock-pdf');

    await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('json', JSON.stringify(dto))
      .attach('file', file, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    expect(ticketRepository.createFingerprint).toHaveBeenCalledWith(
      dto.model,
      dto.text,
      expect.any(Buffer),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('http://ner.internal/analyze');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      'Idempotency-Key': `prompt-analyze:${authentication.userId}:${ticket}`,
    });
    expect(requestInit?.body).toBeInstanceOf(FormData);

    const form = requestInit?.body as FormData;
    expect(form.get('ticket')).toBe(ticket);
    expect(form.get('file')).toBeInstanceOf(Blob);

    const completedResult = ticketRepository.complete.mock.calls[0]?.[4] as
      | PromptResDTO.Analyze
      | undefined;
    expect(completedResult?.masking.file).toEqual({
      fileObjectId: 52,
      maskingCategory: '개인정보',
      detectCnt: 2,
    });
  });

  it('동일 ticket과 동일 요청은 외부 처리를 반복하지 않는다', async () => {
    ticketRepository.acquire.mockResolvedValue({
      type: 'REPLAY',
      record: {
        version: 1,
        status: 'PROCESSING',
        fingerprint: 'request-fingerprint',
        operationId: 'existing-operation',
        createdAt: '2026-07-21T09:00:00.000Z',
      },
    });
    const detectSpy = jest.spyOn(regexDetector, 'detect');

    const response = await postAnalyze(JSON.stringify(dto)).expect(200);

    expect(detectSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ticketRepository.complete).not.toHaveBeenCalled();
    expect(response.body.code).toBe('PROM200_1');
  });

  it('동일 ticket에 다른 요청이 오면 DUPLICATED_TICKET을 반환한다', async () => {
    ticketRepository.acquire.mockResolvedValue({ type: 'CONFLICT' });

    const response = await postAnalyze(JSON.stringify(dto)).expect(400);

    expect(ticketRepository.complete).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_2',
      message: '요청 티켓이 중복되어 요청되었습니다. 기존 요청 결과를 확인해주세요.',
    });
  });

  it('json 필드가 올바른 JSON이 아니면 INVALID_ANALYZE_REQUEST를 반환한다', async () => {
    const response = await postAnalyze('{invalid-json').expect(400);

    expect(ticketRepository.acquire).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_3',
      message: '마스킹 요소 분석 요청 형식이 올바르지 않습니다.',
    });
  });

  it('확장자와 실제 파일 형식이 다르면 INVALID_FILE_FORM을 반환한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('json', JSON.stringify(dto))
      .attach('file', Buffer.from('not-a-pdf'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(ticketRepository.acquire).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_1',
      message: '지원하지 않는 파일 형식입니다.',
    });
  });

  it('NER 서버가 실패하면 FAILED 상태를 기록하고 NER_SERVER_ERROR를 반환한다', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const response = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('json', JSON.stringify(dto))
      .attach('file', Buffer.from('%PDF-1.7\nmock-pdf'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(502);

    expect(ticketRepository.fail).toHaveBeenCalledWith(
      authentication.userId,
      ticket,
      'operation-id',
      'request-fingerprint',
      'PROM502_1',
    );
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM502_1',
      message: '파일 분석 서버 요청에 실패했습니다.',
    });
  });

  it('Redis에서 ticket을 선점하지 못하면 외부 처리를 시작하지 않는다', async () => {
    ticketRepository.acquire.mockRejectedValue(new Error('redis unavailable'));

    const response = await postAnalyze(JSON.stringify(dto)).expect(503);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ticketRepository.complete).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM503_1',
      message: '마스킹 요소 분석 요청을 처리할 수 없습니다.',
    });
  });

  it('인증 토큰이 없으면 TOKEN_MISSING을 반환한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .field('json', JSON.stringify(dto))
      .expect(401);

    expect(ticketRepository.acquire).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_1',
      message: '인증 토큰이 필요합니다.',
    });
  });

  function postAnalyze(json: string) {
    return request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('json', json);
  }

  function resetMocks(): void {
    const mocks = [
      tokenService.verifyAccessToken,
      principalService.getAuthenticatedUser,
      ticketRepository.createFingerprint,
      ticketRepository.acquire,
      ticketRepository.complete,
      ticketRepository.fail,
    ];

    mocks.forEach((mock) => mock.mockReset());
  }
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
