import { execFile as execFileCallback } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { MinioObjectStorageService } from '../../../global/storage/service/minio-object-storage.service.js';
import type { StoredPromptFileExtension } from '../type/stored-prompt-file.type.js';

const execFile = promisify(execFileCallback);
const OCR_TEMP_DIRECTORY_PREFIX = 'llm-gateway-ocr-';
const OCR_LANGUAGE = 'kor+eng';
const OCR_TIMEOUT_MS = 60_000;
const OCR_MAX_BUFFER_BYTES = 256 * 1024;
const MAX_OCR_PDF_PAGES = 20;
const MAX_OCR_TEXT_BYTES = 65_535;
const MAX_OCR_LOG_TEXT_LENGTH = 4_096;

export interface PromptFileOcrRequest {
  readonly objectKey: string;
  readonly extension: StoredPromptFileExtension;
}

/**
 * MinIO에 확정 저장된 파일에서 NER 요청용 텍스트만 추출합니다.
 * 파일 원본·OCR 결과는 임시 디렉터리에서만 처리하고 완료 후 즉시 삭제합니다.
 */
@Injectable()
export class PromptFileOcrService {
  private readonly logger = new Logger(PromptFileOcrService.name);

  constructor(
    private readonly objectStorage: MinioObjectStorageService,
  ) {}

  async extractText(request: Readonly<PromptFileOcrRequest>): Promise<string> {
    const tempDirectory = await mkdtemp(
      join(tmpdir(), OCR_TEMP_DIRECTORY_PREFIX),
    );
    const sourcePath = join(tempDirectory, `source${request.extension}`);

    try {
      await this.downloadObject(request.objectKey, sourcePath);
      const text = request.extension === '.pdf'
        ? await this.extractPdfText(sourcePath, tempDirectory)
        : await this.runTesseract(sourcePath);

      const extractedText = this.normalizeExtractedText(text);
      this.logExtractedText(request, extractedText);
      return extractedText;
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  private async downloadObject(
    objectKey: string,
    destinationPath: string,
  ): Promise<void> {
    const source = await this.objectStorage.getObject(objectKey);
    await pipeline(
      source,
      createWriteStream(destinationPath, { flags: 'wx', mode: 0o600 }),
    );
  }

  private async extractPdfText(
    sourcePath: string,
    tempDirectory: string,
  ): Promise<string> {
    const embeddedText = await this.tryExtractPdfEmbeddedText(
      sourcePath,
      join(tempDirectory, 'embedded.txt'),
    );
    if (embeddedText !== '') {
      return embeddedText;
    }

    const pageCount = await this.getPdfPageCount(sourcePath);
    if (pageCount > MAX_OCR_PDF_PAGES) {
      throw new Error(
        `OCR 가능한 PDF 페이지 수를 초과했습니다: ${pageCount}`,
      );
    }

    const pages: string[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const imageBasePath = join(tempDirectory, `page-${page}`);
      await this.execute('pdftoppm', [
        '-f', String(page),
        '-l', String(page),
        '-r', '200',
        '-png',
        '-singlefile',
        sourcePath,
        imageBasePath,
      ]);
      pages.push(await this.runTesseract(`${imageBasePath}.png`));
    }

    return pages.join('\n');
  }

  private async tryExtractPdfEmbeddedText(
    sourcePath: string,
    outputPath: string,
  ): Promise<string> {
    try {
      await this.execute('pdftotext', [
        '-enc',
        'UTF-8',
        '-layout',
        sourcePath,
        outputPath,
      ]);
      return (await readFile(outputPath, 'utf8')).trim();
    } catch {
      // 텍스트 레이어가 없는 스캔 PDF는 페이지 이미지 OCR로 계속 처리합니다.
      return '';
    }
  }

  private async getPdfPageCount(sourcePath: string): Promise<number> {
    const output = await this.execute('pdfinfo', [sourcePath]);
    const pageCount = /^Pages:\s*(\d+)\s*$/mu.exec(output)?.[1];
    const parsedPageCount = pageCount === undefined ? Number.NaN : Number(pageCount);

    if (
      !Number.isSafeInteger(parsedPageCount)
      || parsedPageCount <= 0
    ) {
      throw new Error('PDF 페이지 수를 확인할 수 없습니다.');
    }

    return parsedPageCount;
  }

  private async runTesseract(sourcePath: string): Promise<string> {
    return this.execute('tesseract', [
      sourcePath,
      'stdout',
      '-l',
      OCR_LANGUAGE,
      '--psm',
      '6',
    ]);
  }

  private async execute(
    command: string,
    args: readonly string[],
  ): Promise<string> {
    const { stdout } = await execFile(command, [...args], {
      encoding: 'utf8',
      timeout: OCR_TIMEOUT_MS,
      maxBuffer: OCR_MAX_BUFFER_BYTES,
      windowsHide: true,
    });

    return stdout;
  }

  private normalizeExtractedText(value: string): string {
    const text = value.replace(/\u0000/gu, '').trim();
    if (Buffer.byteLength(text, 'utf8') > MAX_OCR_TEXT_BYTES) {
      throw new Error('OCR 추출 텍스트가 허용 크기를 초과했습니다.');
    }

    return text;
  }

  /** OCR 원문은 진단용으로만 제한 길이까지 기록해 로그 적재량과 주입을 막습니다. */
  private logExtractedText(
    request: Readonly<PromptFileOcrRequest>,
    text: string,
  ): void {
    this.logger.log(
      `event=prompt_file_ocr_completed object_key=${this.toLoggableText(request.objectKey)} extension=${request.extension} text_chars=${text.length} ocr_text=${this.toLoggableText(text)}`,
    );
  }

  private toLoggableText(value: string): string {
    const normalized = value.replace(/[\r\n\t]+/g, ' ').trim();
    if (normalized === '') {
      return '<empty>';
    }
    if (normalized.length <= MAX_OCR_LOG_TEXT_LENGTH) {
      return normalized;
    }
    return `${normalized.slice(0, MAX_OCR_LOG_TEXT_LENGTH)}…[truncated]`;
  }
}
