import { describe, it, expect } from 'vitest';
import {
  verifyFindings,
  findQuotationOffsets,
  normalizeForSearch,
} from '../../src/shared/evidence/verifier';
import { LLMCandidateFinding, SourceChunk } from '../../src/shared/types';

describe('Evidence Verifier & Quotation Grounding', () => {
  const sourceText =
    'Welcome to Service. 1. Arbitration Clause: Any dispute arising under this agreement shall be settled exclusively by binding arbitration in Delaware. ' +
    '2. Modification: We reserve the right to modify these terms at any time without prior notice. ' +
    '3. Limitation of Liability: In no event shall Company be liable for damages exceeding $50.';

  const chunks: SourceChunk[] = [
    { chunkId: 'chunk_0', text: sourceText, startOffset: 0, endOffset: sourceText.length },
  ];

  it('normalizes Unicode and whitespace for relaxed comparison', () => {
    const raw = 'Hello   world \n test';
    expect(normalizeForSearch(raw)).toBe('Hello world test');
  });

  it('verifies exact verbatim quotation and computes correct offsets', () => {
    const candidates: LLMCandidateFinding[] = [
      {
        id: 'f1',
        category: 'arbitration_jurisdiction',
        severity: 'high',
        originalQuote: 'Any dispute arising under this agreement shall be settled exclusively by binding arbitration in Delaware.',
        explanationTr: 'Zorunlu tahkim maddesi',
        whyItMattersTr: 'Mahkemeye gitmenizi engeller',
        confidence: 0.95,
      },
    ];

    const result = verifyFindings(candidates, sourceText, chunks);
    expect(result.verifiedFindings).toHaveLength(1);
    expect(result.rejectedFindings).toHaveLength(0);

    const verified = result.verifiedFindings[0];
    expect(verified.verificationStatus).toBe('verified');
    expect(sourceText.substring(verified.sourceStartOffset, verified.sourceEndOffset)).toBe(
      candidates[0].originalQuote
    );
  });

  it('rejects completely fabricated quotations not found in source text', () => {
    const candidates: LLMCandidateFinding[] = [
      {
        id: 'f_fake',
        category: 'liability_limitation',
        severity: 'critical',
        originalQuote: 'The company sells all your personal browsing history to third-party advertisers without consent.',
        explanationTr: 'Uydurma iddia',
        whyItMattersTr: 'Bu metin kaynakta yoktur',
        confidence: 0.8,
      },
    ];

    const result = verifyFindings(candidates, sourceText, chunks);
    expect(result.verifiedFindings).toHaveLength(0);
    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0].reason).toContain('FABRICATED_OR_PARAPHRASED_QUOTE');
  });

  it('rejects ambiguous short quotations (< 15 characters)', () => {
    const candidates: LLMCandidateFinding[] = [
      {
        id: 'f_short',
        category: 'unilateral_changes',
        severity: 'medium',
        originalQuote: 'modify these', // Only 12 chars
        explanationTr: 'Çok kısa alıntı',
        whyItMattersTr: 'Kanıt değeri yok',
      },
    ];

    const result = verifyFindings(candidates, sourceText, chunks);
    expect(result.verifiedFindings).toHaveLength(0);
    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0].reason).toContain('AMBIGUOUS_SHORT_QUOTE');
  });

  it('deduplicates duplicate findings quoting the same clause under the same category', () => {
    const candidates: LLMCandidateFinding[] = [
      {
        id: 'f1',
        category: 'unilateral_changes',
        severity: 'medium',
        originalQuote: 'We reserve the right to modify these terms at any time without prior notice.',
        explanationTr: 'Tek taraflı değişiklik hakkı',
        whyItMattersTr: 'Şartlar aniden değişebilir',
      },
      {
        id: 'f2_duplicate',
        category: 'unilateral_changes',
        severity: 'medium',
        originalQuote: 'We reserve the right to modify these terms at any time without prior notice.',
        explanationTr: 'Aynı madde tekrar öne sürülmüş',
        whyItMattersTr: 'Mükerrer bulgu',
      },
    ];

    const result = verifyFindings(candidates, sourceText, chunks);
    expect(result.verifiedFindings).toHaveLength(1);
    expect(result.rejectedFindings).toHaveLength(1);
    expect(result.rejectedFindings[0].reason).toContain('DUPLICATE_FINDING');
  });

  it('findQuotationOffsets handles quotes with whitespace variations', () => {
    const quote = 'settled exclusively by binding arbitration';
    const offsets = findQuotationOffsets(quote, sourceText);
    expect(offsets).not.toBeNull();
    expect(sourceText.substring(offsets!.start, offsets!.end)).toContain('binding arbitration');
  });
});
