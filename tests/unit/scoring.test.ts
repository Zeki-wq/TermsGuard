import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../../src/shared/scoring/calculator';
import { RiskFinding } from '../../src/shared/types';

describe('Deterministic Risk Score Calculator', () => {
  const createFinding = (severity: 'low' | 'medium' | 'high' | 'critical', id = 'f1'): RiskFinding => ({
    id,
    category: 'liability_limitation',
    severity,
    originalQuote: 'Sample verified quote from source',
    explanationTr: 'Örnek açıklama',
    whyItMattersTr: 'Örnek neden önemli',
    sourceChunkId: 'chunk_0',
    sourceStartOffset: 10,
    sourceEndOffset: 45,
    confidence: 0.95,
    verificationStatus: 'verified',
  });

  it('returns 0 score when findings list is empty', () => {
    const result = calculateRiskScore([]);
    expect(result.score).toBe(0);
    expect(result.levelTr).toBe('Düşük Risk');
  });

  it('calculates single low finding correctly (weight: 10 -> score: 10)', () => {
    const findings = [createFinding('low')];
    const result = calculateRiskScore(findings);
    expect(result.score).toBe(10);
  });

  it('calculates single critical finding correctly (weight: 60 -> score: 60)', () => {
    const findings = [createFinding('critical')];
    const result = calculateRiskScore(findings);
    expect(result.score).toBe(60);
    expect(result.levelTr).toBe('Yüksek Risk');
  });

  it('aggregates multiple findings using the mathematical formula: 1 - (1-0.45)*(1-0.25) = 1 - 0.55*0.75 = 0.5875 -> 59', () => {
    const findings = [
      createFinding('high', 'f1'),
      createFinding('medium', 'f2'),
    ];
    const result = calculateRiskScore(findings);
    expect(result.score).toBe(59);
    expect(result.levelTr).toBe('Yüksek Risk');
  });

  it('clamps asymptotic high findings to at most 100', () => {
    const findings = [
      createFinding('critical', 'f1'),
      createFinding('critical', 'f2'),
      createFinding('critical', 'f3'),
      createFinding('critical', 'f4'),
      createFinding('critical', 'f5'),
    ];
    const result = calculateRiskScore(findings);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(98);
    expect(result.levelTr).toBe('Kritik Risk');
  });

  it('handles insufficient coverage by returning 0 score and Belirsiz level', () => {
    const findings = [createFinding('high', 'f1')];
    const result = calculateRiskScore(findings, true);
    expect(result.score).toBe(0);
    expect(result.levelTr).toBe('Belirsiz');
    expect(result.explanationTr).toContain('yetersizdir');
  });
});
