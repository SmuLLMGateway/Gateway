import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import request from 'supertest';
import { ActiveLlmDAO } from '../../src/domain/admin/dao/active-llm.dao.js';
import {
  MaskingClass,
  PolicyDAO,
} from '../../src/domain/admin/dao/policy.dao.js';
import { PromptErrorStatus } from '../../src/domain/prompt/code/prompt.status.js';
import { PromptController } from '../../src/domain/prompt/controller/prompt.controller.js';
import type { PromptData } from '../../src/domain/prompt/data/prompt.data.js';
import { PromptException } from '../../src/domain/prompt/exception/prompt.exception.js';
import { PromptFileExceptionInterceptor } from '../../src/domain/prompt/interceptor/prompt-file-exception.interceptor.js';
import { PromptStagedFileCleanupInterceptor } from '../../src/domain/prompt/interceptor/prompt-staged-file-cleanup.interceptor.js';
import { ParseAnalyzeQueryPipe } from '../../src/domain/prompt/pipe/parse-analyze-query.pipe.js';
import { ParseFileDownloadBodyPipe } from '../../src/domain/prompt/pipe/parse-file-download-body.pipe.js';
import { ParsePrePromptJsonPipe } from '../../src/domain/prompt/pipe/parse-pre-prompt-json.pipe.js';
import { ParseOptionalPromptFileFieldPipe } from '../../src/domain/prompt/pipe/parse-optional-prompt-file-field.pipe.js';
import { MaskingReportRepository } from '../../src/domain/prompt/repository/masking-report.repository.js';
import { PromptFileRepository } from '../../src/domain/prompt/repository/prompt-file.repository.js';
import { PromptRoomRepository } from '../../src/domain/prompt/repository/prompt-room.repository.js';
import { PromptService } from '../../src/domain/prompt/service/prompt.service.js';
import { PromptMinioStorage } from '../../src/domain/prompt/storage/prompt-minio.storage.js';
import {
  MASKING_CONTENT,
  type DepartmentMaskingPolicy,
} from '../../src/domain/prompt/type/masking-content.type.js';
import { MaskingReportStatus } from '../../src/domain/prompt/type/masking-report-status.enum.js';
import { MAX_PROMPT_FILE_SIZE_BYTES } from '../../src/domain/prompt/type/stored-prompt-file.type.js';
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
import type {
  AuthenticatedUser,
  VerifiedAccessToken,
} from '../../src/global/security/type/jwt-payload.type.js';
import { UserRole } from '../../src/global/security/type/user-role.enum.js';
import type {
  CopiedObjectInfo,
  CopyObjectRequest,
  PutObjectRequest,
  StoredObjectInfo,
} from '../../src/global/storage/service/minio-object-storage.service.js';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';

const STAGED_UUID = '11111111-1111-4111-8111-111111111111';
const STAGED_OBJECT_KEY = `incoming/2026/07/21/${STAGED_UUID}.pdf`;
const TEST_BUCKET = 'gateway-test';

class FakeMinioObjectStorageService {
  readonly objects = new Map<string, Buffer>();

  readonly putObject = jest.fn(
    async (input: Readonly<PutObjectRequest>): Promise<StoredObjectInfo> => {
      const chunks: Buffer[] = [];

      for await (const chunk of input.stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      this.objects.set(input.objectKey, Buffer.concat(chunks));
      return {
        bucket: TEST_BUCKET,
        objectKey: input.objectKey,
        etag: 'staged-etag',
        versionId: 'staged-version',
      };
    },
  );

  readonly copyObject = jest.fn(
    async (input: Readonly<CopyObjectRequest>): Promise<CopiedObjectInfo> => {
      const source = this.objects.get(input.sourceObjectKey);
      if (source === undefined) {
        throw new Error('복사할 staging 객체가 없습니다.');
      }

      this.objects.set(input.destinationObjectKey, Buffer.from(source));
      return {
        bucket: TEST_BUCKET,
        objectKey: input.destinationObjectKey,
        etag: 'final-etag',
        versionId: 'final-version',
      };
    },
  );

  readonly presignedGetObject = jest.fn(async (objectKey: string) =>
    `https://minio.internal/${objectKey}`,
  );

  readonly getObjectUrl = jest.fn((objectKey: string) =>
    `s3://${TEST_BUCKET}/${objectKey}`,
  );

  readonly parseObjectUrl = jest.fn((objectUrl: string) => {
    const prefix = `s3://${TEST_BUCKET}/`;
    if (!objectUrl.startsWith(prefix)) {
      throw new Error('잘못된 테스트 객체 URL입니다.');
    }

    return objectUrl.slice(prefix.length);
  });

  readonly removeObject = jest.fn(
    async (objectKey: string, _versionId?: string): Promise<void> => {
      this.objects.delete(objectKey);
    },
  );

  readonly removeIncompleteUpload = jest.fn(
    async (_objectKey: string): Promise<void> => undefined,
  );

  reset(): void {
    this.objects.clear();
  }
}

describe('마스킹 요소 탐지 요청 HTTP API', () => {
  const ticket = 'a81cc17e-e10a-46ae-8113-dceffb932d6c';
  const departmentId = '7';
  const finalObjectKey = `masking/${STAGED_UUID}.pdf`;
  const file = Buffer.from('%PDF-1.7\nstreamed-mock-pdf');
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
    recentTicket: null,
    chatRoomId: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
  };
  const policies: DepartmentMaskingPolicy[] = [
    {
      policyId: '101',
      maskingContent: MASKING_CONTENT.PHONE,
      maskingClass: MaskingClass.PRIVATE,
    },
    {
      policyId: '102',
      maskingContent: MASKING_CONTENT.RESIDENT,
      maskingClass: MaskingClass.PRIVATE,
    },
    {
      policyId: '103',
      maskingContent: MASKING_CONTENT.CARD,
      maskingClass: MaskingClass.PRIVATE,
    },
    {
      policyId: '104',
      maskingContent: MASKING_CONTENT.EMAIL,
      maskingClass: MaskingClass.PRIVATE,
    },
    {
      policyId: '105',
      maskingContent: MASKING_CONTENT.API_KEY,
      maskingClass: MaskingClass.SENSITIVE,
    },
  ];

  const tokenService = {
    verifyAccessToken: jest.fn(),
  };
  const principalService = {
    getAuthenticatedUser: jest.fn(),
  };
  const memberDepartmentRepository = {
    findOne: jest.fn(),
  };
  const activeLlmRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const policyRepository = {
    find: jest.fn(),
  };
  const reportRepository = {
    create: jest.fn(),
    validateRequestTickets: jest.fn(),
    findAnalyzeResult: jest.fn(),
    saveRegexDetections: jest.fn(),
    saveNerDetections: jest.fn(),
    cancelRegex: jest.fn(),
    cancelNer: jest.fn(),
  };
  const promptFileRepository = {
    create: jest.fn(),
    deleteById: jest.fn(),
    findDownloadReferenceByFileUrl: jest.fn(),
    findByReportId: jest.fn(),
  };
  const promptRoomRepository = {
    existsByIdAndMemberId: jest.fn(),
    findRecentByMemberId: jest.fn(),
  };
  const objectStorage = new FakeMinioObjectStorageService();

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MulterModule.register({
          storage: new PromptMinioStorage(
            objectStorage as unknown as MinioObjectStorageService,
            {
              now: () => new Date('2026-07-21T00:00:00.000Z'),
              randomId: () => STAGED_UUID,
            },
          ),
          limits: {
            fileSize: MAX_PROMPT_FILE_SIZE_BYTES,
            files: 1,
            fields: 2,
            // busboy의 partsLimit 이벤트가 정상적인 json+file 경계에서
            // 발생하지 않도록 허용 개수에 한 칸의 여유를 둡니다.
            parts: 3,
          },
        }),
      ],
      controllers: [PromptController],
      providers: [
        PromptService,
        ParseOptionalPromptFileFieldPipe,
        ParseAnalyzeQueryPipe,
        ParseFileDownloadBodyPipe,
        ParsePrePromptJsonPipe,
        PromptFileExceptionInterceptor,
        PromptStagedFileCleanupInterceptor,
        Reflector,
        AccessTokenGuard,
        RolesGuard,
        {
          provide: getRepositoryToken(MemberDepartmentDAO),
          useValue: memberDepartmentRepository,
        },
        {
          provide: getRepositoryToken(ActiveLlmDAO),
          useValue: activeLlmRepository,
        },
        {
          provide: getRepositoryToken(PolicyDAO),
          useValue: policyRepository,
        },
        { provide: MaskingReportRepository, useValue: reportRepository },
        { provide: PromptFileRepository, useValue: promptFileRepository },
        { provide: PromptRoomRepository, useValue: promptRoomRepository },
        { provide: MinioObjectStorageService, useValue: objectStorage },
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
    jest.clearAllMocks();
    objectStorage.reset();

    tokenService.verifyAccessToken.mockResolvedValue({
      userId: authentication.userId,
      expiredAt: authentication.expiredAt,
      accessToken: true,
    } satisfies VerifiedAccessToken);
    principalService.getAuthenticatedUser.mockResolvedValue(authentication);
    memberDepartmentRepository.findOne.mockResolvedValue({ departmentId });
    activeLlmRepository.findOne.mockResolvedValue({
      activeLlmId: '100',
    });
    policyRepository.find.mockResolvedValue(policies.slice(0, 4));
    reportRepository.validateRequestTickets.mockResolvedValue(undefined);
    reportRepository.create.mockResolvedValue(undefined);
    reportRepository.findAnalyzeResult.mockResolvedValue(null);
    reportRepository.saveRegexDetections.mockResolvedValue(true);
    reportRepository.saveNerDetections.mockResolvedValue(true);
    reportRepository.cancelRegex.mockResolvedValue(true);
    reportRepository.cancelNer.mockResolvedValue(true);
    promptFileRepository.create.mockResolvedValue({
      promptFileId: '52',
      fileOriginalName: 'report.pdf',
      fileUrl: `s3://${TEST_BUCKET}/${finalObjectKey}`,
      maskingReportId: ticket,
    });
    promptFileRepository.deleteById.mockResolvedValue(undefined);
    promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValue(null);
    promptFileRepository.findByReportId.mockResolvedValue([]);
    promptRoomRepository.existsByIdAndMemberId.mockResolvedValue(true);
    promptRoomRepository.findRecentByMemberId.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /api/v1/analyze', () => {
    it('본인이 요청한 DONE 리포트의 탐지 결과를 PROM200_2로 반환한다', async () => {
      const originText = '연락처 010-1234-5678, api_key=AbCdEfGhIjKlMnOp1234';
      const phone = '010-1234-5678';
      const apiKey = 'AbCdEfGhIjKlMnOp1234';
      reportRepository.findAnalyzeResult.mockResolvedValueOnce({
        status: MaskingReportStatus.DONE,
        originalText: originText,
        details: [
          {
            originalText: phone,
            startIdx: originText.indexOf(phone),
            endIdx: originText.indexOf(phone) + phone.length,
            maskingContent: MASKING_CONTENT.PHONE,
            maskingClass: MaskingClass.PRIVATE,
          },
          {
            originalText: apiKey,
            startIdx: originText.indexOf(apiKey),
            endIdx: originText.indexOf(apiKey) + apiKey.length,
            maskingContent: MASKING_CONTENT.API_KEY,
            maskingClass: MaskingClass.SENSITIVE,
          },
        ],
      } satisfies PromptData.AnalyzeReport);

      const response = await getAnalyze().expect(200);

      expect(reportRepository.findAnalyzeResult).toHaveBeenCalledWith(
        ticket,
        authentication.userId,
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.pragma).toBe('no-cache');
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'PROM200_2',
        message: '성공적으로 마스킹 요소를 탐지했습니다.',
        result: {
          originText,
          masking: {
            file: null,
            text: [
              {
                targetText: phone,
                startIdx: originText.indexOf(phone),
                endIdx: originText.indexOf(phone) + phone.length,
                maskingCategory: '개인정보',
                detailCategory: '전화번호',
              },
              {
                targetText: apiKey,
                startIdx: originText.indexOf(apiKey),
                endIdx: originText.indexOf(apiKey) + apiKey.length,
                maskingCategory: '민감정보',
                detailCategory: 'API Key',
              },
            ],
          },
        },
      });
    });

    it('DONE 리포트에 탐지 내역이 없으면 결과를 null로 반환한다', async () => {
      reportRepository.findAnalyzeResult.mockResolvedValueOnce({
        status: MaskingReportStatus.DONE,
        originalText: '탐지 항목이 없는 원문',
        details: [],
      } satisfies PromptData.AnalyzeReport);

      const response = await getAnalyze().expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'PROM200_2',
        message: '성공적으로 마스킹 요소를 탐지했습니다.',
        result: null,
      });
    });

    it('파일 탐지 결과에는 DB 파일 URL과 탐지 건수를 반환한다', async () => {
      reportRepository.findAnalyzeResult.mockResolvedValueOnce({
        status: MaskingReportStatus.DONE,
        originalText: dto.text,
        details: [
          {
            originalText: null,
            startIdx: null,
            endIdx: null,
            maskingContent: MASKING_CONTENT.PHONE,
            maskingClass: MaskingClass.PRIVATE,
          },
          {
            originalText: null,
            startIdx: null,
            endIdx: null,
            maskingContent: MASKING_CONTENT.API_KEY,
            maskingClass: MaskingClass.SENSITIVE,
          },
        ],
      } satisfies PromptData.AnalyzeReport);
      promptFileRepository.findByReportId.mockResolvedValueOnce([
        {
          promptFileId: '52',
          fileOriginalName: 'report.pdf',
          fileUrl: `s3://${TEST_BUCKET}/${finalObjectKey}`,
          maskingReportId: ticket,
        },
      ]);

      const response = await getAnalyze().expect(200);

      expect(promptFileRepository.findByReportId).toHaveBeenCalledWith(ticket);
      expect(response.body.result).toEqual({
        originText: dto.text,
        masking: {
          file: {
            fileOriginalName: 'report.pdf',
            fileUrl: `s3://${TEST_BUCKET}/${finalObjectKey}`,
            maskingCategory: '민감정보',
            detectCnt: 2,
          },
          text: [],
        },
      });
    });

    it('PENDING 리포트는 PROM200_2_1을 반환한다', async () => {
      reportRepository.findAnalyzeResult.mockResolvedValueOnce({
        status: MaskingReportStatus.PENDING,
        originalText: dto.text,
        details: [],
      } satisfies PromptData.AnalyzeReport);

      const response = await getAnalyze().expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'PROM200_2_1',
        message: '아직 분석이 진행 중입니다.',
        result: null,
      });
    });

    it.each([
      ['존재하지 않는 티켓', ticket],
      ['다른 사용자 소유 티켓', 'b25e1559-bf8c-42f8-a1da-a56f013516ac'],
    ])('%s은 소유 여부를 노출하지 않고 PROM404_1을 반환한다', async (
      _caseName,
      requestTicket,
    ) => {
      reportRepository.findAnalyzeResult.mockResolvedValueOnce(null);

      const response = await getAnalyze(requestTicket).expect(404);

      expect(reportRepository.findAnalyzeResult).toHaveBeenCalledWith(
        requestTicket,
        authentication.userId,
      );
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM404_1',
        message: '해당 분석 요청을 찾을 수 없습니다.',
      });
    });

    it('UUID가 아닌 티켓은 조회하지 않고 PROM400_3으로 거부한다', async () => {
      const response = await getAnalyze('not-a-uuid').expect(400);

      expect(reportRepository.findAnalyzeResult).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM400_3',
        message: '마스킹 요소 분석 요청 형식이 올바르지 않습니다.',
      });
    });

    it('ticket을 body로만 보내면 PROM400_3으로 거부한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/analyze')
        .set('Authorization', 'Bearer access-token')
        .send({ ticket })
        .expect(400);

      expect(reportRepository.findAnalyzeResult).not.toHaveBeenCalled();
      expect(response.body.code).toBe('PROM400_3');
    });

    it('CANCEL 리포트는 PROM503_1을 반환한다', async () => {
      reportRepository.findAnalyzeResult.mockResolvedValueOnce({
        status: MaskingReportStatus.CANCEL,
        originalText: dto.text,
        details: [],
      } satisfies PromptData.AnalyzeReport);

      const response = await getAnalyze().expect(503);

      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM503_1',
        message: '마스킹 요소 분석 요청을 처리할 수 없습니다.',
      });
    });

    it('인증 토큰이 없으면 AUTH401_1을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/analyze')
        .query({ ticket })
        .expect(401);

      expect(reportRepository.findAnalyzeResult).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH401_1',
        message: '인증 토큰이 필요합니다.',
      });
    });
  });

  describe('GET /api/v1/download', () => {
    const fileUrl = `s3://${TEST_BUCKET}/${finalObjectKey}`;

    it('파일 소유자에게 10분 유효 presigned URL을 반환한다', async () => {
      promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValueOnce({
        promptFileId: '52',
        fileUrl,
        maskingReportId: ticket,
        memberId: String(authentication.userId),
      });

      const response = await getDownload().expect(200);

      expect(
        promptFileRepository.findDownloadReferenceByFileUrl,
      ).toHaveBeenCalledWith(
        fileUrl,
      );
      expect(objectStorage.parseObjectUrl).toHaveBeenCalledWith(fileUrl);
      expect(objectStorage.presignedGetObject).toHaveBeenCalledWith(
        finalObjectKey,
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.pragma).toBe('no-cache');
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'PROM200_7',
        message: '성공적으로 파일 다운로드 URL을 생성했습니다.',
        result: `https://minio.internal/${finalObjectKey}`,
      });
    });

    it.each([
      ['누락', {}],
      ['빈 문자열', { fileUrl: '' }],
      ['복수 값', { fileUrl: [fileUrl, fileUrl] }],
      ['최대 길이 초과', { fileUrl: `s3://${'a'.repeat(1_024)}` }],
      ['추가 필드', { fileUrl, unexpected: 'field' }],
    ])('fileUrl이 %s이면 PROM400_5로 거부한다', async (
      _description,
      body,
    ) => {
      const response = await getDownload(body).expect(400);

      expect(
        promptFileRepository.findDownloadReferenceByFileUrl,
      ).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM400_5',
        message: '파일 다운로드 URL 생성 요청 형식이 올바르지 않습니다.',
      });
    });

    it('파일 레코드가 없으면 PROM404_3을 반환한다', async () => {
      const response = await getDownload().expect(404);

      expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM404_3',
        message: '해당 파일을 찾을 수 없습니다.',
      });
    });

    it('fileUrl을 body로만 보내면 PROM400_5로 거부한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/download')
        .set('Authorization', 'Bearer access-token')
        .send({ fileUrl })
        .expect(400);

      expect(
        promptFileRepository.findDownloadReferenceByFileUrl,
      ).not.toHaveBeenCalled();
      expect(response.body.code).toBe('PROM400_5');
    });

    it('다른 사용자의 파일이면 PROM403_2를 반환한다', async () => {
      promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValueOnce({
        promptFileId: '52',
        fileUrl,
        maskingReportId: ticket,
        memberId: '999',
      });

      const response = await getDownload().expect(403);

      expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM403_2',
        message: '해당 파일을 업로드한 사용자가 아닙니다.',
      });
    });

    it('DB 파일 URL이 현재 버킷의 canonical URL이 아니면 PROM404_3을 반환한다', async () => {
      promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValueOnce({
        promptFileId: '52',
        fileUrl: 's3://other-bucket/masking/ticket/source',
        maskingReportId: ticket,
        memberId: String(authentication.userId),
      });

      const response = await getDownload().expect(404);

      expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
      expect(response.body.code).toBe('PROM404_3');
    });

    it('MinIO URL 발급이 실패하면 PROM503_2를 반환한다', async () => {
      promptFileRepository.findDownloadReferenceByFileUrl.mockResolvedValueOnce({
        promptFileId: '52',
        fileUrl,
        maskingReportId: ticket,
        memberId: String(authentication.userId),
      });
      objectStorage.presignedGetObject.mockRejectedValueOnce(
        new Error('minio unavailable'),
      );

      const response = await getDownload().expect(503);

      expect(response.body).toEqual({
        isSuccess: false,
        code: 'PROM503_2',
        message: '파일 다운로드 URL을 생성할 수 없습니다.',
      });
    });

    it('인증 토큰이 없으면 AUTH401_1을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/download')
        .query({ fileUrl })
        .expect(401);

      expect(
        promptFileRepository.findDownloadReferenceByFileUrl,
      ).not.toHaveBeenCalled();
      expect(response.body.code).toBe('AUTH401_1');
    });
  });

  describe('GET /api/v1/chat-rooms', () => {
    it('토큰 사용자 소유의 최근 채팅방을 PROM200_5로 반환한다', async () => {
      promptRoomRepository.findRecentByMemberId.mockResolvedValueOnce([
        {
          chatRoomId: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
          title: 'A사와 체결 보고서 작성',
          createdAt: new Date('2026-07-19T17:33:30.000Z'),
        },
        {
          chatRoomId: '57ed5b8b-e77b-49c7-823d-802537d756a3',
          title: '보안 검토',
          createdAt: '2026-07-18T09:15:00.000Z',
        },
      ] satisfies PromptData.RecentPrompt[]);

      const response = await getRecentPrompts().expect(200);

      expect(promptRoomRepository.findRecentByMemberId).toHaveBeenCalledWith(
        String(authentication.userId),
      );
      expect(promptFileRepository.findByReportId).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: true,
        code: 'PROM200_5',
        message: '성공적으로 채팅 과거 기록을 조회했습니다.',
        result: [
          {
            chatRoomId: '840c66ce-0b5d-4663-bc63-b4c4666cd0f5',
            title: 'A사와 체결 보고서 작성',
            createdAt: '2026-07-19T17:33:30.000Z',
          },
          {
            chatRoomId: '57ed5b8b-e77b-49c7-823d-802537d756a3',
            title: '보안 검토',
            createdAt: '2026-07-18T09:15:00.000Z',
          },
        ],
      });
    });

    it('채팅방이 없으면 PROM200_5와 result null을 반환한다', async () => {
      const response = await getRecentPrompts().expect(200);

      expect(response.body).toEqual({
        isSuccess: true,
        code: 'PROM200_5',
        message: '성공적으로 채팅 과거 기록을 조회했습니다.',
        result: null,
      });
    });

    it('인증 토큰이 없으면 AUTH401_1을 반환하고 조회하지 않는다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/chat-rooms')
        .expect(401);

      expect(promptRoomRepository.findRecentByMemberId).not.toHaveBeenCalled();
      expect(response.body).toEqual({
        isSuccess: false,
        code: 'AUTH401_1',
        message: '인증 토큰이 필요합니다.',
      });
    });
  });

  it('부서의 활성 모델과 개인정보 정책을 검증해 탐지 상세를 저장한다', async () => {
    const response = await postAnalyze().expect(200);

    expect(memberDepartmentRepository.findOne).toHaveBeenCalledWith({
      select: { departmentId: true },
      where: { memberId: String(authentication.userId) },
    });
    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId, serviceType: 'Anthropic' },
        llmDetailModel: { llmName: dto.model },
      },
    });
    expect(reportRepository.validateRequestTickets).toHaveBeenCalledWith(
      ticket,
      dto.recentTicket,
      authentication.userId,
    );
    expect(promptRoomRepository.existsByIdAndMemberId).toHaveBeenCalledWith(
      dto.chatRoomId,
      String(authentication.userId),
    );
    expect(policyRepository.find).toHaveBeenCalledWith({
      select: {
        policyId: true,
        maskingContent: true,
        maskingClass: true,
      },
      where: {
        isActive: true,
        maskingClass: MaskingClass.PRIVATE,
        departmentPolicies: {
          departmentId,
          isActive: true,
        },
      },
      order: { policyId: 'ASC' },
    });
    expect(reportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      dto.text,
      null,
    );

    const savedDetections = reportRepository.saveRegexDetections.mock
      .calls[0]?.[1] as PromptData.RegexDetection[] | undefined;
    expect(savedDetections).toEqual([
      expect.objectContaining({
        originalText: '010-1234-5678',
        maskingText: '[ 전화번호 ]',
        policyId: '101',
      }),
      expect.objectContaining({
        originalText: '900101-1234567',
        maskingText: '[ 주민등록번호 ]',
        policyId: '102',
      }),
      expect.objectContaining({
        originalText: '4111 1111 1111 1111',
        maskingText: '[ 카드번호 ]',
        policyId: '103',
      }),
      expect.objectContaining({
        originalText: 'member@example.com',
        maskingText: '[ 이메일 ]',
        policyId: '104',
      }),
    ]);
    expect(
      savedDetections?.every(
        (detection) =>
          dto.text.slice(detection.startIdx, detection.endIdx)
          === detection.originalText,
      ),
    ).toBe(true);
    expect(reportRepository.saveNerDetections).not.toHaveBeenCalled();
    expect(objectStorage.putObject).not.toHaveBeenCalled();
    expect(objectStorage.copyObject).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_1',
      message: '성공적으로 마스킹 요소 분석을 요청했습니다.',
      result: null,
    });
  });

  it('하이픈 없는 카드번호 후보는 Luhn 체크섬과 무관하게 탐지한다', async () => {
    const cardNumber = '5327501123254829';
    const cardDto = {
      ...dto,
      text: `카드번호 ${cardNumber}`,
    };

    await postAnalyze(cardDto).expect(200);

    expect(reportRepository.saveRegexDetections).toHaveBeenCalledWith(ticket, [
      {
        originalText: cardNumber,
        startIdx: cardDto.text.indexOf(cardNumber),
        endIdx: cardDto.text.indexOf(cardNumber) + cardNumber.length,
        maskingText: '[ 카드번호 ]',
        policyId: '103',
      },
    ]);
  });

  it('카드번호 앞의 일반 숫자와 공백은 탐지 범위에서 제외한다', async () => {
    const cardNumber = '5327501134352675';
    const cardDto = {
      ...dto,
      text: `원본 텍스트2 ${cardNumber} 테스트2`,
    };

    await postAnalyze(cardDto).expect(200);

    expect(reportRepository.saveRegexDetections).toHaveBeenCalledWith(ticket, [
      {
        originalText: cardNumber,
        startIdx: cardDto.text.indexOf(cardNumber),
        endIdx: cardDto.text.indexOf(cardNumber) + cardNumber.length,
        maskingText: '[ 카드번호 ]',
        policyId: '103',
      },
    ]);
  });

  it('file= 빈 일반 필드는 파일 미첨부로 처리하고 MinIO 저장을 생략한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('file', '')
      .field('json', JSON.stringify(dto))
      .expect(200);

    expect(reportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      dto.text,
      null,
    );
    expect(objectStorage.putObject).not.toHaveBeenCalled();
    expect(objectStorage.copyObject).not.toHaveBeenCalled();
    expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
    expect(promptFileRepository.create).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_1',
      message: '성공적으로 마스킹 요소 분석을 요청했습니다.',
      result: null,
    });
  });

  it('비어 있지 않은 일반 file 필드는 PROM400_3으로 거부한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('file', 'not-a-file')
      .field('json', JSON.stringify(dto))
      .expect(400);

    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(objectStorage.putObject).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_3',
      message: '마스킹 요소 분석 요청 형식이 올바르지 않습니다.',
    });
  });

  it('TEXT 용량인 UTF-8 65,535바이트를 초과한 원문은 PROM400_3으로 거부한다', async () => {
    const response = await postAnalyze({
      ...dto,
      text: '가'.repeat(21_846),
    }).expect(400);

    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_3',
      message: '마스킹 요소 분석 요청 형식이 올바르지 않습니다.',
    });
  });

  it('NER가 비활성화되어 NER 완료 리포트의 정규식 분기만 완료한다', async () => {
    const response = await postAnalyzeWithFile(file).expect(200);

    expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
    expect(reportRepository.saveRegexDetections).toHaveBeenCalledTimes(1);
    expect(reportRepository.saveNerDetections).not.toHaveBeenCalled();
    expect(reportRepository.cancelNer).not.toHaveBeenCalled();
    expect(promptFileRepository.create).toHaveBeenCalledWith(
      ticket,
      `s3://${TEST_BUCKET}/${finalObjectKey}`,
      'report.pdf',
    );
    await waitForCall(() => hasRemovedObject(STAGED_OBJECT_KEY));
    expect(objectStorage.objects.get(finalObjectKey)).toEqual(file);
    expect(objectStorage.objects.has(STAGED_OBJECT_KEY)).toBe(false);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_1',
      message: '성공적으로 마스킹 요소 분석을 요청했습니다.',
      result: null,
    });
  });

  it('부서 정책에 포함되지 않은 마스킹 항목은 탐지하지 않는다', async () => {
    policyRepository.find.mockResolvedValueOnce([
      policies[3],
    ]);

    await postAnalyze().expect(200);

    expect(reportRepository.saveRegexDetections).toHaveBeenCalledWith(ticket, [
      {
        originalText: 'member@example.com',
        startIdx: dto.text.indexOf('member@example.com'),
        endIdx: dto.text.indexOf('member@example.com') + 'member@example.com'.length,
        maskingText: '[ 이메일 ]',
        policyId: '104',
      },
    ]);
  });

  it('파일을 최종 위치에 저장하고 NER 외부 요청은 생략한다', async () => {
    const response = await postAnalyzeWithFile(file).expect(200);

    expect(reportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      dto.text,
      null,
    );
    expect(objectStorage.putObject).toHaveBeenCalledTimes(1);
    const putRequest = objectStorage.putObject.mock.calls[0]?.[0];
    expect(putRequest).toEqual({
      objectKey: STAGED_OBJECT_KEY,
      stream: expect.any(Readable),
      contentType: 'application/pdf',
    });
    expect(putRequest).not.toHaveProperty('buffer');
    expect(objectStorage.copyObject).toHaveBeenCalledWith({
      sourceObjectKey: STAGED_OBJECT_KEY,
      destinationObjectKey: finalObjectKey,
      sourceVersionId: 'staged-version',
    });
    expect(promptFileRepository.create).toHaveBeenCalledWith(
      ticket,
      `s3://${TEST_BUCKET}/${finalObjectKey}`,
      'report.pdf',
    );
    expect(objectStorage.presignedGetObject).not.toHaveBeenCalled();
    expect(reportRepository.saveNerDetections).not.toHaveBeenCalled();

    await waitForCall(() => hasRemovedObject(STAGED_OBJECT_KEY));
    expect(objectStorage.objects.get(finalObjectKey)).toEqual(file);
    expect(objectStorage.objects.has(STAGED_OBJECT_KEY)).toBe(false);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_1',
      message: '성공적으로 마스킹 요소 분석을 요청했습니다.',
      result: null,
    });
  });

  it('파일 확장자와 magic byte가 다르면 PROM400_1을 반환한다', async () => {
    const response = await postAnalyzeWithFile(Buffer.from('not-a-pdf')).expect(400);

    await waitForCall(() =>
      objectStorage.removeIncompleteUpload.mock.calls.some(
        ([objectKey]) => objectKey === STAGED_OBJECT_KEY,
      ),
    );
    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_1',
      message: '지원하지 않는 파일 형식입니다.',
    });
  });

  it('파일 내용이 비어 있어도 저장하고 PROM200_1을 반환한다', async () => {
    const response = await postAnalyzeWithFile(
      Buffer.alloc(0),
      'application/octet-stream',
    ).expect(200);

    expect(reportRepository.create).toHaveBeenCalledWith(
      ticket,
      authentication.userId,
      dto.text,
      null,
    );
    expect(objectStorage.copyObject).toHaveBeenCalledWith({
      sourceObjectKey: STAGED_OBJECT_KEY,
      destinationObjectKey: finalObjectKey,
      sourceVersionId: 'staged-version',
    });
    await waitForCall(() => hasRemovedObject(STAGED_OBJECT_KEY));
    expect(objectStorage.objects.get(finalObjectKey)).toEqual(Buffer.alloc(0));
    expect(objectStorage.objects.has(STAGED_OBJECT_KEY)).toBe(false);
    expect(response.body).toEqual({
      isSuccess: true,
      code: 'PROM200_1',
      message: '성공적으로 마스킹 요소 분석을 요청했습니다.',
      result: null,
    });
  });

  it('정규식 분기 완료에 실패하면 prompt_file과 최종 객체를 보상 삭제한다', async () => {
    reportRepository.saveRegexDetections.mockResolvedValueOnce(false);

    const response = await postAnalyzeWithFile(file).expect(503);

    expect(promptFileRepository.deleteById).toHaveBeenCalledWith('52');
    expect(objectStorage.removeObject).toHaveBeenCalledWith(
      finalObjectKey,
      'final-version',
    );
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM503_1',
      message: '마스킹 요소 분석 요청을 처리할 수 없습니다.',
    });
  });

  it('활성화되지 않은 모델이면 staging 파일을 정리하고 PROM403_1을 반환한다', async () => {
    activeLlmRepository.findOne.mockResolvedValueOnce(null);

    const response = await postAnalyzeWithFile(file).expect(403);

    await waitForCall(() => hasRemovedObject(STAGED_OBJECT_KEY));
    expect(activeLlmRepository.findOne).toHaveBeenCalledWith({
      select: { activeLlmId: true },
      where: {
        activeApiKey: { departmentId, serviceType: 'Anthropic' },
        llmDetailModel: { llmName: dto.model },
      },
    });
    expect(reportRepository.validateRequestTickets).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(objectStorage.copyObject).not.toHaveBeenCalled();
    expect(objectStorage.objects.has(STAGED_OBJECT_KEY)).toBe(false);
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM403_1',
      message: '해당 부서에선 사용이 제한된 모델입니다.',
    });
  });

  it('요청자 소유의 채팅방이 없으면 PROM404_6을 반환한다', async () => {
    promptRoomRepository.existsByIdAndMemberId.mockResolvedValueOnce(false);

    const response = await postAnalyze().expect(404);

    expect(reportRepository.validateRequestTickets).toHaveBeenCalledWith(
      ticket,
      dto.recentTicket,
      authentication.userId,
    );
    expect(promptRoomRepository.existsByIdAndMemberId).toHaveBeenCalledWith(
      dto.chatRoomId,
      String(authentication.userId),
    );
    expect(policyRepository.find).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM404_6',
      message: '해당 채팅방을 찾을 수 없습니다.',
    });
  });

  it('DB에 같은 ticket이 존재하면 PROM400_2를 반환한다', async () => {
    reportRepository.validateRequestTickets.mockRejectedValueOnce(
      new PromptException(PromptErrorStatus.DUPLICATED_TICKET),
    );

    const response = await postAnalyze().expect(400);

    expect(reportRepository.saveRegexDetections).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM400_2',
      message: '요청 티켓이 중복되어 요청되었습니다. 기존 요청 결과를 확인해주세요.',
    });
  });

  it('DB 처리 중 예기치 않은 오류가 발생하면 PROM503_1을 반환한다', async () => {
    reportRepository.create.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await postAnalyze().expect(503);

    expect(reportRepository.saveRegexDetections).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'PROM503_1',
      message: '마스킹 요소 분석 요청을 처리할 수 없습니다.',
    });
  });

  it('인증 토큰이 없으면 AUTH401_1을 반환한다', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/analyze')
      .field('json', JSON.stringify(dto))
      .expect(401);

    expect(memberDepartmentRepository.findOne).not.toHaveBeenCalled();
    expect(reportRepository.create).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      isSuccess: false,
      code: 'AUTH401_1',
      message: '인증 토큰이 필요합니다.',
    });
  });

  function postAnalyze(requestDto: typeof dto = dto) {
    return request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('json', JSON.stringify(requestDto));
  }

  function getAnalyze(requestTicket = ticket) {
    return request(app.getHttpServer())
      .get('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .query({ ticket: requestTicket });
  }

  function getDownload(
    query: Record<string, unknown> = {
      fileUrl: `s3://${TEST_BUCKET}/${finalObjectKey}`,
    },
  ) {
    return request(app.getHttpServer())
      .get('/api/v1/download')
      .set('Authorization', 'Bearer access-token')
      .query(query);
  }

  function getRecentPrompts() {
    return request(app.getHttpServer())
      .get('/api/v1/chat-rooms')
      .set('Authorization', 'Bearer access-token');
  }

  function postAnalyzeWithFile(
    contents: Buffer,
    contentType = 'application/pdf',
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/analyze')
      .set('Authorization', 'Bearer access-token')
      .field('json', JSON.stringify(dto))
      .attach('file', contents, {
        filename: 'report.pdf',
        contentType,
      });
  }

  function hasRemovedObject(objectKey: string): boolean {
    return objectStorage.removeObject.mock.calls.some(
      ([removedObjectKey]) => removedObjectKey === objectKey,
    );
  }
});

async function waitForCall(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  expect(predicate()).toBe(true);
}
