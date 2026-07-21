import { Injectable } from '@nestjs/common';
import { PromptResDTO } from '../dto/prompt.response.dto.js';

type MaskingCategory = '개인정보' | '민감정보';
type DetailCategory =
  | '전화번호'
  | '주민등록번호'
  | '카드번호'
  | '이메일'
  | 'API Key';

interface DetectionCandidate extends PromptResDTO.MaskingText {
  priority: number;
}

interface CandidateOptions {
  maskingCategory: MaskingCategory;
  detailCategory: DetailCategory;
  priority: number;
  validate?: (value: string) => boolean;
  captureGroup?: number;
}

const PHONE_PATTERNS = [
  /(?<!\d)01[016789][ .-]?\d{3,4}[ .-]?\d{4}(?!\d)/g,
  /(?<!\d)(?:02[ .-]?\d{3,4}[ .-]?\d{4}|0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4]|70|80)[ .-]?\d{3,4}[ .-]?\d{4})(?!\d)/g,
] as const;

const RESIDENT_REGISTRATION_NUMBER_PATTERN =
  /(?<!\d)\d{6}[ -]?[1-4]\d{6}(?!\d)/g;

const CARD_NUMBER_PATTERN = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;

const EMAIL_PATTERN =
  /(?<![A-Z0-9.!#$%&'*+/=?^_`{|}~-])[A-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?){1,10}(?![A-Z0-9.-])/gi;

const KNOWN_API_KEY_PATTERNS = [
  /(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-|ant-(?:api\d{2}-)?)?[A-Za-z0-9_-]{16,256}(?![A-Za-z0-9_-])/g,
  /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_-])/g,
  /(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/g,
  /(?<![A-Za-z0-9_])(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,128}(?![A-Za-z0-9_])/g,
  /(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{20,255}(?![A-Za-z0-9_])/g,
] as const;

const CONTEXTUAL_API_KEY_PATTERN =
  /\b(?:api[_ -]?key|apikey|client[_ -]?secret|secret[_ -]?key|access[_ -]?token)\b\s{0,8}(?::|=)\s{0,8}["']?([A-Za-z0-9][A-Za-z0-9_./+=-]{14,253}[A-Za-z0-9_=+-])["']?/gi;

@Injectable()
export class RegexMaskingDetectorService {
  detect(text: string): PromptResDTO.MaskingText[] {
    if (text.length === 0) {
      return [];
    }

    const candidates: DetectionCandidate[] = [];

    for (const pattern of PHONE_PATTERNS) {
      candidates.push(
        ...this.findCandidates(text, pattern, {
          maskingCategory: '개인정보',
          detailCategory: '전화번호',
          priority: 60,
        }),
      );
    }

    candidates.push(
      ...this.findCandidates(text, RESIDENT_REGISTRATION_NUMBER_PATTERN, {
        maskingCategory: '개인정보',
        detailCategory: '주민등록번호',
        priority: 90,
        validate: (value) => this.hasValidResidentRegistrationDate(value),
      }),
      ...this.findCandidates(text, CARD_NUMBER_PATTERN, {
        maskingCategory: '개인정보',
        detailCategory: '카드번호',
        priority: 80,
        validate: (value) => this.isValidCardNumber(value),
      }),
      ...this.findCandidates(text, EMAIL_PATTERN, {
        maskingCategory: '개인정보',
        detailCategory: '이메일',
        priority: 70,
        validate: (value) => this.isValidEmail(value),
      }),
    );

    for (const pattern of KNOWN_API_KEY_PATTERNS) {
      candidates.push(
        ...this.findCandidates(text, pattern, {
          maskingCategory: '민감정보',
          detailCategory: 'API Key',
          priority: 100,
        }),
      );
    }

    candidates.push(
      ...this.findCandidates(text, CONTEXTUAL_API_KEY_PATTERN, {
        maskingCategory: '민감정보',
        detailCategory: 'API Key',
        priority: 95,
        captureGroup: 1,
        validate: (value) => this.hasSufficientKeyDiversity(value),
      }),
    );

    return this.resolveOverlaps(candidates).map(
      ({ priority: _priority, ...detection }) => detection,
    );
  }

  private findCandidates(
    text: string,
    pattern: RegExp,
    options: CandidateOptions,
  ): DetectionCandidate[] {
    const matcher = new RegExp(pattern.source, pattern.flags);
    const detections: DetectionCandidate[] = [];
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(text)) !== null) {
      const fullMatch = match[0];
      const value = options.captureGroup === undefined
        ? fullMatch
        : match[options.captureGroup];

      if (value === undefined || value.length === 0) {
        continue;
      }

      if (options.validate !== undefined && !options.validate(value)) {
        continue;
      }

      const offsetInFullMatch = options.captureGroup === undefined
        ? 0
        : fullMatch.lastIndexOf(value);

      if (offsetInFullMatch < 0) {
        continue;
      }

      const startIdx = match.index + offsetInFullMatch;
      detections.push({
        targetText: value,
        startIdx,
        endIdx: startIdx + value.length,
        maskingCategory: options.maskingCategory,
        detailCategory: options.detailCategory,
        priority: options.priority,
      });
    }

    return detections;
  }

  private hasValidResidentRegistrationDate(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');
    if (digits.length !== 13) {
      return false;
    }

    const centuryCode = Number(digits.charAt(6));
    const century = centuryCode === 1 || centuryCode === 2 ? 1900 : 2000;
    const year = century + Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const day = Number(digits.slice(4, 6));

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  private isValidCardNumber(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');
    if (!/^\d{13,19}$/.test(digits) || /^(\d)\1+$/.test(digits)) {
      return false;
    }

    let sum = 0;
    let shouldDouble = false;

    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits.charAt(index));
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  private isValidEmail(value: string): boolean {
    if (value.length > 254) {
      return false;
    }

    const separatorIndex = value.lastIndexOf('@');
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
      return false;
    }

    const localPart = value.slice(0, separatorIndex);
    const domain = value.slice(separatorIndex + 1);
    if (
      localPart.length > 64
      || localPart.startsWith('.')
      || localPart.endsWith('.')
      || localPart.includes('..')
      || domain.length > 253
    ) {
      return false;
    }

    return domain.split('.').every(
      (label) => label.length > 0
        && label.length <= 63
        && !label.startsWith('-')
        && !label.endsWith('-'),
    );
  }

  private hasSufficientKeyDiversity(value: string): boolean {
    const characterGroups = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[_./+=-]/.test(value),
    ].filter(Boolean).length;

    return characterGroups >= 2 && !/^(.)\1+$/.test(value);
  }

  private resolveOverlaps(
    candidates: readonly DetectionCandidate[],
  ): DetectionCandidate[] {
    const byConfidence = [...candidates].sort((left, right) => {
      const priorityDifference = right.priority - left.priority;
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const lengthDifference =
        (right.endIdx - right.startIdx) - (left.endIdx - left.startIdx);
      if (lengthDifference !== 0) {
        return lengthDifference;
      }

      return left.startIdx - right.startIdx;
    });

    const selected: DetectionCandidate[] = [];
    for (const candidate of byConfidence) {
      const overlaps = selected.some(
        (existing) => candidate.startIdx < existing.endIdx
          && existing.startIdx < candidate.endIdx,
      );

      if (!overlaps) {
        selected.push(candidate);
      }
    }

    return selected.sort((left, right) =>
      left.startIdx - right.startIdx || left.endIdx - right.endIdx,
    );
  }
}
