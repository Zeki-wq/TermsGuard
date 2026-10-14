import { describe, it, expect } from 'vitest';
import {
  parseAndValidateLLMResponse,
  validateRiskReport,
  sanitizeRawJsonString,
} from '../../src/shared/schema/validator';
import { RiskReport, MANDATORY_LEGAL_DISCLAIMER } from '../../src/shared/types';

describe('Ajv Schema Validation & Sanitizer', () => {
  it('strips markdown code blocks correctly', () => {
    const raw = '```json\n{"summaryTr": "test", "findings": [], "uncertainties": []}\n```';
    const cleaned = sanitizeRawJsonString(raw);
    expect(cleaned).toBe('{"summaryTr": "test", "findings": [], "uncertainties": []}');
  });

  it('validates conforming raw LLM response', () => {
    const raw = JSON.stringify({
      summaryTr: 'Kısa sözleşme özeti',
      findings: [
        {
          id: 'f1',
          category: 'liability_limitation',
          severity: 'high',
          originalQuote: 'Company is not liable for any damages whatsoever.',
          explanationTr: 'Sorumluluk reddi maddesi.',
          whyItMattersTr: 'Tazminat almanızı engeller.',
          confidence: 0.9,
        },
      ],
      uncertainties: ['Bazı ek sözleşmelere atıf yapılmış.'],
    });

    const result = parseAndValidateLLMResponse(raw);
    expect(result.valid).toBe(true);
    expect(result.data?.findings).toHaveLength(1);
  });

  it('rejects invalid JSON syntax that cannot be repaired', () => {
    const broken = '{ summaryTr: incomplete';
    const result = parseAndValidateLLMResponse(broken);
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain('JSON');
  });

  it('rejects response missing required fields (e.g. missing findings)', () => {
    const invalid = JSON.stringify({
      summaryTr: 'Eksik rapor',
      uncertainties: [],
    });
    const result = parseAndValidateLLMResponse(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('findings'))).toBe(true);
  });

  it('validates a complete RiskReport successfully', () => {
    const validReport: RiskReport = {
      schemaVersion: '1.0.0',
      document: {
        title: 'Kullanım Koşulları',
        url: 'https://example.com/terms',
        domain: 'example.com',
        documentType: 'Kullanım Koşulları',
        characterCount: 1500,
        chunkCount: 1,
      },
      analysisStatus: 'success',
      overallRiskScore: 45,
      scoreExplanation: 'Açıklama metni',
      coverage: {
        completeness: 'complete',
        explanationTr: 'Tam metin incelendi',
        truncated: false,
      },
      findings: [
        {
          id: 'f1',
          category: 'liability_limitation',
          severity: 'high',
          originalQuote: 'Company is not liable for damages.',
          explanationTr: 'Sorumluluk sınırlandırması',
          whyItMattersTr: 'Tazminat engeli',
          sourceChunkId: 'chunk_0',
          sourceStartOffset: 100,
          sourceEndOffset: 134,
          confidence: 0.9,
          verificationStatus: 'verified',
        },
      ],
      rejectedFindings: [],
      uncertainties: [],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    };

    const result = validateRiskReport(validReport);
    expect(result.valid).toBe(true);
  });

  it('rejects RiskReport with additional unknown properties (additionalProperties: false)', () => {
    const invalidReport: any = {
      schemaVersion: '1.0.0',
      document: {
        title: 'Terms',
        url: 'https://example.com',
        domain: 'example.com',
        documentType: 'Terms',
        characterCount: 100,
        chunkCount: 1,
      },
      analysisStatus: 'success',
      overallRiskScore: 10,
      scoreExplanation: 'Test',
      coverage: { completeness: 'complete', explanationTr: 'Tam', truncated: false },
      findings: [],
      rejectedFindings: [],
      uncertainties: [],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      maliciousInjectedField: 'HACKED', // Disallowed additional property
    };

    const result = validateRiskReport(invalidReport);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('additional') || e.includes('maliciousInjectedField'))).toBe(true);
  });
});
