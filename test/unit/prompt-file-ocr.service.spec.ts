import { execFile as execFileCallback } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { Logger } from '@nestjs/common';
import { MinioObjectStorageService } from '../../src/global/storage/service/minio-object-storage.service.js';
import { PromptFileOcrService } from '../../src/domain/prompt/service/prompt-file-ocr.service.js';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

describe('PromptFileOcrService', () => {
  const objectStorage = {
    getObject: jest.fn(),
  };
  const executeCommand = execFileCallback as unknown as jest.Mock;
  const service = new PromptFileOcrService(
    objectStorage as unknown as MinioObjectStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    objectStorage.getObject.mockResolvedValue(
      Readable.from(Buffer.from('mock-image-binary')),
    );
    executeCommand.mockImplementation((
      _command: string,
      _args: readonly string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      // jest.fn()에는 node:child_process의 promisify.custom 구현이 없으므로
      // promisify가 그대로 반환할 stdout 객체를 흉내 냅니다.
      callback(null, {
        stdout: '  이미지 OCR 텍스트\n',
        stderr: '',
      } as unknown as string, '');
    });
  });

  it('MinIO에 저장된 이미지를 내려받아 한국어·영어 Tesseract OCR로 텍스트를 추출하고 로그를 남긴다', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(service.extractText({
      objectKey: 'masking/2026/08/file.png',
      extension: '.png',
    })).resolves.toBe('이미지 OCR 텍스트');

    expect(objectStorage.getObject).toHaveBeenCalledWith(
      'masking/2026/08/file.png',
    );
    expect(executeCommand).toHaveBeenCalledWith(
      'tesseract',
      [
        expect.stringMatching(/source\.png$/u),
        'stdout',
        '-l',
        'kor+eng',
        '--psm',
        '6',
      ],
      expect.objectContaining({
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 256 * 1024,
      }),
      expect.any(Function),
    );
    expect(log).toHaveBeenCalledWith(
      'event=prompt_file_ocr_completed object_key=masking/2026/08/file.png extension=.png text_chars=11 ocr_text=이미지 OCR 텍스트',
    );
    log.mockRestore();
  });

  it('JPEG OCR 결과도 같은 형식으로 로그를 남긴다', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(service.extractText({
      objectKey: 'masking/2026/08/file.jpg',
      extension: '.jpg',
    })).resolves.toBe('이미지 OCR 텍스트');

    expect(executeCommand).toHaveBeenCalledWith(
      'tesseract',
      [
        expect.stringMatching(/source\.jpg$/u),
        'stdout',
        '-l',
        'kor+eng',
        '--psm',
        '6',
      ],
      expect.any(Object),
      expect.any(Function),
    );
    expect(log).toHaveBeenCalledWith(
      'event=prompt_file_ocr_completed object_key=masking/2026/08/file.jpg extension=.jpg text_chars=11 ocr_text=이미지 OCR 텍스트',
    );
    log.mockRestore();
  });

  it('PDF 텍스트 레이어 추출 결과도 로그를 남긴다', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    executeCommand.mockImplementation((
      command: string,
      args: readonly string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      if (command === 'pdftotext') {
        writeFileSync(args.at(-1)!, '  PDF OCR 텍스트\n', 'utf8');
      }
      callback(null, {
        stdout: '',
        stderr: '',
      } as unknown as string, '');
    });

    await expect(service.extractText({
      objectKey: 'masking/2026/08/file.pdf',
      extension: '.pdf',
    })).resolves.toBe('PDF OCR 텍스트');

    expect(executeCommand).toHaveBeenCalledWith(
      'pdftotext',
      expect.arrayContaining(['-enc', 'UTF-8', '-layout']),
      expect.any(Object),
      expect.any(Function),
    );
    expect(log).toHaveBeenCalledWith(
      'event=prompt_file_ocr_completed object_key=masking/2026/08/file.pdf extension=.pdf text_chars=11 ocr_text=PDF OCR 텍스트',
    );
    log.mockRestore();
  });
});
