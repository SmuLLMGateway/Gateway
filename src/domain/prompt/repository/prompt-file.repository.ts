import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptFileDAO } from '../dao/prompt-file.dao.js';

export interface PromptFileReference {
  readonly promptFileId: string;
  readonly fileUrl: string;
  readonly fileOriginalName: string;
  readonly maskingReportId: string;
}

export interface PromptFileDownloadReference extends PromptFileReference {
  readonly memberId: string;
}

@Injectable()
export class PromptFileRepository {
  constructor(
    @InjectRepository(PromptFileDAO)
    private readonly repository: Repository<PromptFileDAO>,
  ) {}

  async create(
    maskingReportId: string,
    fileUrl: string,
    fileOriginalName: string,
  ): Promise<PromptFileReference> {
    const promptFile = this.repository.create({
      fileUrl,
      fileOriginalName,
      maskingReportId,
    });
    const saved = await this.repository.save(promptFile);

    return this.toReference(saved);
  }

  async deleteById(promptFileId: string): Promise<void> {
    await this.repository.delete({ promptFileId });
  }

  async findDownloadReferenceByFileUrl(
    fileUrl: string,
  ): Promise<PromptFileDownloadReference | null> {
    const promptFile = await this.repository.findOne({
      select: {
        promptFileId: true,
        fileUrl: true,
        fileOriginalName: true,
        maskingReportId: true,
        maskingReport: {
          memberId: true,
        },
      },
      relations: {
        maskingReport: true,
      },
      where: {
        fileUrl,
      },
    });

    if (promptFile === null) {
      return null;
    }

    return {
      ...this.toReference(promptFile),
      memberId: promptFile.maskingReport.memberId,
    };
  }

  async findByReportId(
    maskingReportId: string,
  ): Promise<readonly PromptFileReference[]> {
    const promptFiles = await this.repository.find({
      select: {
        promptFileId: true,
        fileUrl: true,
        fileOriginalName: true,
        maskingReportId: true,
      },
      where: {
        maskingReportId,
      },
      order: {
        promptFileId: 'ASC',
      },
    });

    return promptFiles.map((promptFile) => this.toReference(promptFile));
  }

  private toReference(promptFile: PromptFileDAO): PromptFileReference {
    return {
      promptFileId: promptFile.promptFileId,
      fileUrl: promptFile.fileUrl,
      fileOriginalName: promptFile.fileOriginalName,
      maskingReportId: promptFile.maskingReportId,
    };
  }
}
