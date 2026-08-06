import { Logger } from '@nestjs/common';
import { ProviderClient, type ProviderRequest } from '../../src/global/llm/client/provider.client.js';
import { ProviderConfig } from '../../src/global/llm/config/provider.config.js';

describe('ProviderClient', () => {
  const request: ProviderRequest = {
    ticket: 'f0762447-2fa8-4394-bef2-3cbe7f968fa6',
    model: 'gpt-5.4-nano',
    apiKey: 'sk-provider-secret-value',
    text: '마스킹된 프롬프트 본문',
    files: [],
  };
  const config = {
    baseUrl: 'http://provider.internal:8001/',
    requestTimeoutMs: 90_000,
  } as ProviderConfig;

  let client: ProviderClient;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    client = new ProviderClient(config);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('성공 요청·응답 로그에 본문을 남기되 API 키는 마스킹한다', async () => {
    const loggerLogSpy = jest.spyOn(Logger.prototype, 'log')
      .mockImplementation();
    const responseBody = JSON.stringify({
      output_text: 'Provider 응답 본문',
      total_usd: 0.01,
      response_id: 'provider-response-1',
      provider: 'GPT',
      model: request.model,
    });
    fetchSpy.mockResolvedValueOnce(new Response(responseBody, { status: 200 }));

    try {
      await expect(client.request(request)).resolves.toEqual({
        outputText: 'Provider 응답 본문',
        totalUsd: 0.01,
        responseId: 'provider-response-1',
        provider: 'GPT',
      });
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining(
        'request_body={"model":"gpt-5.4-nano","api_key":"[REDACTED]","text":"마스킹된 프롬프트 본문","files":[]}',
      ));
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining(
        `response_body=${responseBody}`,
      ));
      expect(loggerLogSpy.mock.calls.flat().join(' '))
        .not.toContain(request.apiKey);
    } finally {
      loggerLogSpy.mockRestore();
    }
  });

  it('Provider 오류 응답에도 마스킹된 요청 본문과 응답 본문을 남긴다', async () => {
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error')
      .mockImplementation();
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      detail: 'upstream model timeout',
    }), { status: 504 }));

    try {
      await expect(client.request(request)).rejects.toThrow(
        'Provider 요청이 실패했습니다. status=504',
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'event=provider_request_failed',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'status=504 result=http_error',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'request_body={"model":"gpt-5.4-nano","api_key":"[REDACTED]"',
      ));
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(
        'response_body={"detail":"upstream model timeout"}',
      ));
      expect(loggerErrorSpy.mock.calls.flat().join(' '))
        .not.toContain(request.apiKey);
    } finally {
      loggerErrorSpy.mockRestore();
    }
  });
});
