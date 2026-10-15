// Compiled standalone validation functions (No runtime 'new Function' or 'eval' -> 100% CSP compliant in Manifest V3)
// @ts-ignore - handled by compiled-validators.d.ts
import { validateRiskReport as compiledValidateRiskReport, validateLLMResponse as compiledValidateLLMResponse } from './compiled-validators.js';
import { RawLLMResponse, RiskReport } from '../types';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
  repaired?: boolean;
}

/**
 * Attempts controlled repair of common LLM JSON syntax issues (markdown fences, trailing commas, etc.)
 */
export function sanitizeRawJsonString(input: string): string {
  let cleaned = input.trim();
  // Strip markdown code fences e.g. ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
    cleaned = cleaned.trim();
  }
  return cleaned;
}

export function parseAndValidateLLMResponse(rawString: string): ValidationResult<RawLLMResponse> {
  const sanitized = sanitizeRawJsonString(rawString);
  let parsed: unknown;

  try {
    parsed = JSON.parse(sanitized);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Controlled repair attempt: try to extract JSON object between first { and last }
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const candidate = sanitized.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(candidate);
      } catch {
        return {
          valid: false,
          errors: [`JSON ayrıştırma hatası: ${errorMsg}`],
          repaired: false,
        };
      }
    } else {
      return {
        valid: false,
        errors: [`Geçerli bir JSON yapısı bulunamadı: ${errorMsg}`],
        repaired: false,
      };
    }
  }

  const isValid = compiledValidateLLMResponse(parsed);
  if (!isValid) {
    const errors = formatErrors(compiledValidateLLMResponse.errors);
    return {
      valid: false,
      errors,
      repaired: false,
    };
  }

  return {
    valid: true,
    data: parsed as RawLLMResponse,
  };
}

export function validateRiskReport(report: unknown): ValidationResult<RiskReport> {
  const isValid = compiledValidateRiskReport(report);
  if (!isValid) {
    const errors = formatErrors(compiledValidateRiskReport.errors);
    return {
      valid: false,
      errors,
    };
  }
  return {
    valid: true,
    data: report as RiskReport,
  };
}

function formatErrors(errors?: Array<{ instancePath?: string; message?: string; keyword?: string }> | null): string[] {
  if (!errors || errors.length === 0) return ['Bilinmeyen şema doğrulama hatası.'];
  return errors.map((err) => {
    const path = err.instancePath || 'root';
    return `${path} ${err.message ?? ''} (kural: ${err.keyword ?? 'unknown'})`.trim();
  });
}
