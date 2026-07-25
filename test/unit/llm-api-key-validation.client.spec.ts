import { LlmApiKeyValidationClient } from '../../src/global/llm/client/llm-api-key-validation.client.js';
import { LlmApiKeyValidationConfig } from '../../src/global/llm/config/llm-api-key-validation.config.js';
import { LlmApiKeyValidationFailure } from '../../src/global/llm/enum/llm-api-key-validation-failure.enum.js';
import { LlmApiKeyValidationResult } from '../../src/global/llm/enum/llm-api-key-validation-result.enum.js';
import { LlmProvider } from '../../src/global/llm/enum/llm-provider.enum.js';
import { LlmApiKeyValidationException } from '../../src/global/llm/exception/llm-api-key-validation.exception.js';
import { Logger } from '@nestjs/common';

const API_KEY = 'unit-test-api-key';

describe('LlmApiKeyValidationConfig', () => {
  const config = new LlmApiKeyValidationConfig();

  it('provider별 검증 주소를 고정 HTTPS URL로 제공한다', () => {
    expect(config.getTarget(LlmProvider.GEMINI)).toEqual({
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      responseArrayField: 'models',
    });
    expect(config.getTarget(LlmProvider.GPT)).toEqual({
      url: 'https://api.openai.com/v1/models',
      responseArrayField: 'data',
    });
    expect(config.getTarget(LlmProvider.CLAUDE)).toEqual({
      url: 'https://api.anthropic.com/v1/models?limit=1',
      responseArrayField: 'data',
    });
  });

  it('기본 요청 timeout은 5초이다', () => {
    expect(config.requestTimeoutMs).toBe(5_000);
  });
});

describe('LlmApiKeyValidationClient', () => {
  const config = new LlmApiKeyValidationConfig();
  let client: LlmApiKeyValidationClient;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    client = new LlmApiKeyValidationClient(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it.each([
    {
      provider: LlmProvider.GEMINI,
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      headers: {
        accept: 'application/json',
        'x-goog-api-key': API_KEY,
      },
      payload: { models: [] },
    },
    {
      provider: LlmProvider.GPT,
      url: 'https://api.openai.com/v1/models',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      payload: { data: [] },
    },
    {
      provider: LlmProvider.CLAUDE,
      url: 'https://api.anthropic.com/v1/models?limit=1',
      headers: {
        accept: 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      payload: { data: [] },
    },
  ])(
    '$provider 검증은 고정 URL과 provider 전용 인증 헤더를 사용한다',
    async ({ provider, url, headers, payload }) => {
      fetchSpy.mockResolvedValueOnce(Response.json(payload));

      await expect(client.validate(provider, API_KEY)).resolves.toBe(
        LlmApiKeyValidationResult.VALID,
      );

      expect(fetchSpy).toHaveBeenCalledWith(url, {
        method: 'GET',
        headers,
        redirect: 'error',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      });
    },
  );

  it.each([400, 401, 403, 404])(
    'HTTP %i 응답은 잘못된 API 키로 판별한다',
    async (status) => {
      fetchSpy.mockResolvedValueOnce(new Response('sensitive response', {
        status,
      }));

      await expect(
        client.validate(LlmProvider.GPT, API_KEY),
      ).resolves.toBe(LlmApiKeyValidationResult.INVALID);
    },
  );

  it('검증 로그에는 provider와 상태만 남기고 API 키와 응답 본문은 제외한다', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const responseBody = `provider rejected ${API_KEY}`;
    fetchSpy.mockResolvedValueOnce(new Response(responseBody, { status: 403 }));

    await client.validate(LlmProvider.GPT, API_KEY);

    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(logged).toBe(
      'event=llm_api_key_validation provider=GPT status=403 result=INVALID',
    );
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain(responseBody);
    warnSpy.mockRestore();
  });

  it.each([408, 429, 500, 503])(
    'HTTP %i 응답은 잠시적 장애로 분류한다',
    async (status) => {
      fetchSpy.mockResolvedValueOnce(new Response('sensitive response', {
        status,
      }));

      await expect(
        client.validate(LlmProvider.GPT, API_KEY),
      ).rejects.toMatchObject({
        name: LlmApiKeyValidationException.name,
        failure: LlmApiKeyValidationFailure.TRANSIENT,
        transient: true,
      });
    },
  );

  it('network 실패를 키 정보 없는 잠시적 장애로 변환한다', async () => {
    fetchSpy.mockRejectedValueOnce(
      new Error(`network failed while sending ${API_KEY}`),
    );

    const error = await captureValidationError(
      client.validate(LlmProvider.GPT, API_KEY),
    );

    expect(error).toMatchObject({
      failure: LlmApiKeyValidationFailure.TRANSIENT,
      transient: true,
    });
    expect(error.message).not.toContain(API_KEY);
    expect(error.cause).toBeUndefined();
  });

  it.each([
    { payload: { data: {} }, description: '배열이 아닌 필드' },
    { payload: { models: [] }, description: '다른 provider의 필드' },
  ])(
    '2xx에서 $description를 받으면 비일시적 provider 응답 오류로 분류한다',
    async ({ payload }) => {
      fetchSpy.mockResolvedValueOnce(Response.json(payload));

      await expect(
        client.validate(LlmProvider.GPT, API_KEY),
      ).rejects.toMatchObject({
        failure: LlmApiKeyValidationFailure.UNEXPECTED_RESPONSE,
        transient: false,
      });
    },
  );

  it('JSON이 아닌 2xx 응답 본문을 예외에 노출하지 않는다', async () => {
    const responseBody = 'upstream-sensitive-response-body';
    fetchSpy.mockResolvedValueOnce(new Response(responseBody, { status: 200 }));

    const error = await captureValidationError(
      client.validate(LlmProvider.CLAUDE, API_KEY),
    );

    expect(error).toMatchObject({
      failure: LlmApiKeyValidationFailure.UNEXPECTED_RESPONSE,
      transient: false,
    });
    expect(error.message).not.toContain(responseBody);
  });

  it.each(['', '   ', 'key\r\ninjected-header'])(
    '빈 키 또는 헤더 주입 문자가 포함된 키는 요청하지 않고 거부한다',
    async (apiKey) => {
      await expect(
        client.validate(LlmProvider.GEMINI, apiKey),
      ).resolves.toBe(LlmApiKeyValidationResult.INVALID);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('지원하지 않는 provider는 안전한 예외로 거부한다', async () => {
    await expect(
      client.validate('Unknown' as LlmProvider, API_KEY),
    ).rejects.toMatchObject({
      failure: LlmApiKeyValidationFailure.UNSUPPORTED_PROVIDER,
      transient: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

async function captureValidationError(
  validation: Promise<LlmApiKeyValidationResult>,
): Promise<LlmApiKeyValidationException> {
  try {
    await validation;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(LlmApiKeyValidationException);
    return error as LlmApiKeyValidationException;
  }

  throw new Error('검증 요청이 예외 없이 완료되었습니다.');
}
