import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ActiveApiKeyDAO } from '../../src/domain/admin/dao/active-api-key.dao.js';
import { LlmDetailModelDAO } from '../../src/domain/admin/dao/llm-detail-model.dao.js';
import {
  MaskingClass,
  PolicyDAO,
} from '../../src/domain/admin/dao/policy.dao.js';
import { NerClient } from '../../src/global/ner/client/ner.client.js';
import { NerConfig } from '../../src/global/ner/config/ner.config.js';
import { NerCallbackController } from '../../src/domain/prompt/controller/ner-callback.controller.js';
import { NerCallbackGuard } from '../../src/domain/prompt/guard/ner-callback.guard.js';
import { ParseNerCallbackPipe } from '../../src/domain/prompt/pipe/parse-ner-callback.pipe.js';
import { MaskingReportRepository } from '../../src/domain/prompt/repository/masking-report.repository.js';
import { PromptFileRepository } from '../../src/domain/prompt/repository/prompt-file.repository.js';
import { PromptRoomRepository } from '../../src/domain/prompt/repository/prompt-room.repository.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { MemberDepartmentDAO } from '../../src/domain/user/dao/member-department.dao.js';
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
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

describe('NER 분석 결과 콜백 HTTP API', () => {
  const ticket = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const callbackSecret = 'test-ner-callback-secret';
  const finalObjectKey = `masking/${ticket}/source`;
  const fileUrl = `s3://gateway-test/${finalObjectKey}`;
  const maskingReportRepository = {
    cancelNer: jest.fn(),
    findMemberId: jest.fn(),
    saveNerDetections: jest.fn(),
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
  };
  const activeApiKeyRepository = {
    findOne: jest.fn(),
  };
  const policyRepository = {
    find: jest.fn(),
  };
  const llmDetailModelRepository = {
    find: jest.fn(),
  };
  const tokenService = {
    verifyAccessToken: jest.fn(),
  };
  const principalService = {
    getAuthenticatedUser: jest.fn(),
  };
  const objectStorage = {
    getObjectUrl: jest.fn(),
  };

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NerCallbackController],
      providers: [
        PromptService,
        ParseNerCallbackPipe,
        NerCallbackGuard,
        Reflector,
        AccessTokenGuard,
        RolesGuard,
        {
          // PromptService가 아닌 콜백 인증 Guard에서 사용합니다.
          provide: NerConfig,
          useValue: { callbackSecret },
        },
        {
          provide: MaskingReportRepository,
          useValue: maskingReportRepository,
        },
        {
          provide: PromptFileRepository,
          useValue: {},
        },
        {
          provide: PromptRoomRepository,
          useValue: {},
        },
        {
          provide: getRepositoryToken(MemberDepartmentDAO),
          useValue: memberDepartmentRepository,
        },
        {
          provide: getRepositoryToken(ActiveApiKeyDAO),
          useValue: activeApiKeyRepository,
        },
        {
          provide: getRepositoryToken(PolicyDAO),
          useValue: policyRepository,
        },
        {
          provide: getRepositoryToken(LlmDetailModelDAO),
          useValue: llmDetailModelRepository,
        },
        { provide: MinioObjectStorageService, useValue: objectStorage },
        { provide: NerClient, useValue: {} },
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
    await app.init();
  });

  beforeEach(() => {
    resetMocks();
    maskingReportRepository.findMemberId.mockResolvedValue('42');
    maskingReportRepository.saveNerDetections.mockResolvedValue(true);
    maskingReportRepository.cancelNer.mockResolvedValue(true);
    objectStorage.getObjectUrl.mockReturnValue(fileUrl);
    memberDepartmentRepository.findOne.mockResolvedValue({ departmentId: '10' });
    activeApiKeyRepository.findOne.mockResolvedValue({ activeApiKeyId: '100' });
    policyRepository.find.mockResolvedValue([
      {
        policyId: '101',
        maskingContent: 'PHONE',
        maskingClass: MaskingClass.PRIVATE,
      },
      {
        policyId: '102',
        maskingContent: 'API_KEY',
        maskingClass: MaskingClass.SENSITIVE,
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('DONE 탐지 항목을 부서 정책 ID로 변환하여 저장한다', async () => {
    const response = await postCallback({
      ticket,
      status: 'DONE',
      detections: [
        { maskingContent: ' phone ' },
        { maskingContent: 'api key' },
      ],
    }).expect(200);

    expect(maskingReportRepository.findMemberId).toHaveBeenCalledWith(ticket);
    expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true },
      where: { memberId: '42' },
    });
    expect(policyRepository.find).toHaveBeenCalledWith({
      select: {
        policyId: true,
        maskingContent: true,
        maskingClass: true,
      },
      where: { departmentId: '10', isActive: true },
      order: { policyId: 'ASC' },
    });
    expect(maskingReportRepository.saveNerDetections).toHaveBeenCalledWith(
      ticket,
      fileUrl,
      [{ policyId: '101' }, { policyId: '102' }],
    );
    expect(objectStorage.getObjectUrl).toHaveBeenCalledWith(finalObjectKey);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_11',
      message: '성공적으로 파일 분석 결과를 반영했습니다.',
      result: null,
    });

    // 클래스의 @Public() 메타데이터로 전역 JWT 인증 Guard를 우회합니다.
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    expect(principalService.getAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('CANCEL 콜백이면 NER 분석을 취소 상태로 전환한다', async () => {
    const response = await postCallback({
      ticket,
      status: 'CANCEL',
      detections: [],
    }).expect(200);

    expect(maskingReportRepository.cancelNer).toHaveBeenCalledWith(ticket);
    expect(maskingReportRepository.findMemberId).not.toHaveBeenCalled();
    expect(maskingReportRepository.saveNerDetections).not.toHaveBeenCalled();
    expect(objectStorage.getObjectUrl).not.toHaveBeenCalled();
    expect(response.body.code).toBe('PROM200_11');
  });

  it('이미 DONE인 콜백은 저장소가 false를 반환해도 멱등 성공한다', async () => {
    maskingReportRepository.saveNerDetections.mockResolvedValue(false);

    const response = await postCallback({
      ticket,
      status: 'DONE',
      detections: [{ maskingContent: 'PHONE' }],
    }).expect(200);

    expect(maskingReportRepository.saveNerDetections).toHaveBeenCalledWith(
      ticket,
      fileUrl,
      [{ policyId: '101' }],
    );
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_11',
      message: '성공적으로 파일 분석 결과를 반영했습니다.',
      result: null,
    });
  });

  it('부서 정책에 없는 maskingContent이면 PROM400_4를 반환한다', async () => {
    const response = await postCallback({
      ticket,
      status: 'DONE',
      detections: [{ maskingContent: 'UNKNOWN' }],
    }).expect(400);

    expect(maskingReportRepository.saveNerDetections).not.toHaveBeenCalled();
    expect(objectStorage.getObjectUrl).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_4',
      message: '파일 분석 결과 형식이 올바르지 않습니다.',
    });
  });

  it('ticket에 해당하는 리포트가 없으면 PROM404_1을 반환한다', async () => {
    maskingReportRepository.findMemberId.mockResolvedValue(null);

    const response = await postCallback({
      ticket,
      status: 'DONE',
      detections: [],
    }).expect(404);

    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
    expect(policyRepository.find).not.toHaveBeenCalled();
    expect(maskingReportRepository.saveNerDetections).not.toHaveBeenCalled();
    expect(objectStorage.getObjectUrl).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM404_1',
      message: '해당 분석 요청을 찾을 수 없습니다.',
    });
  });

  it('콜백 secret이 누락되면 AUTH401_2를 반환한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/v1/ner/callback')
      .send({ ticket, status: 'CANCEL', detections: [] })
      .expect(401);

    expect(maskingReportRepository.cancelNer).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
  });

  it('콜백 secret이 일치하지 않으면 AUTH401_2를 반환한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/v1/ner/callback')
      .set('x-ner-callback-secret', 'wrong-secret')
      .send({ ticket, status: 'CANCEL', detections: [] })
      .expect(401);

    expect(maskingReportRepository.cancelNer).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_2',
      message: '유효하지 않은 토큰입니다.',
    });
  });

  function postCallback(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/internal/v1/ner/callback')
      .set('x-ner-callback-secret', callbackSecret)
      .send(body);
  }

  function resetMocks(): void {
    const mocks = [
      maskingReportRepository.cancelNer,
      maskingReportRepository.findMemberId,
      maskingReportRepository.saveNerDetections,
      memberDepartmentRepository.findOne,
      activeApiKeyRepository.findOne,
      policyRepository.find,
      tokenService.verifyAccessToken,
      principalService.getAuthenticatedUser,
      objectStorage.getObjectUrl,
    ];

    mocks.forEach((mock) => mock.mockReset());
  }
});
