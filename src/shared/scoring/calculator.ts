import { RiskFinding, SEVERITY_WEIGHTS } from '../types';

export interface ScoreCalculationResult {
  score: number;
  levelTr: 'Düşük Risk' | 'Orta Risk' | 'Yüksek Risk' | 'Kritik Risk' | 'Belirsiz';
  explanationTr: string;
}

/**
 * Calculates deterministic risk score based strictly on verified findings.
 * Formula: score = round(100 * (1 - product(1 - weight_i / 100)))
 */
export function calculateRiskScore(
  verifiedFindings: RiskFinding[],
  isCoverageInsufficient: boolean = false
): ScoreCalculationResult {
  if (isCoverageInsufficient) {
    return {
      score: 0,
      levelTr: 'Belirsiz',
      explanationTr:
        'Sayfadaki metin hacmi veya erişilebilir içerik kapsamlı bir risk analizi için yetersizdir. Eksik veri nedeniyle genel bir risk puanı hesaplanamamıştır.',
    };
  }

  if (verifiedFindings.length === 0) {
    return {
      score: 0,
      levelTr: 'Düşük Risk',
      explanationTr:
        'İncelenen sözleşme metninde sistem tarafından tanımlanmış standart yüksek riskli maddelere rastlanmadı veya bulunan maddeler doğrulama kriterlerini karşılamadı. Bu durum sözleşmenin tamamen risksiz olduğunu garanti etmez.',
    };
  }

  // Calculate product of (1 - weight_i / 100)
  let complementProduct = 1.0;
  for (const finding of verifiedFindings) {
    const weight = SEVERITY_WEIGHTS[finding.severity] ?? 10;
    complementProduct *= (1 - weight / 100);
  }

  const rawScore = 100 * (1 - complementProduct);
  const clampedScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  let levelTr: 'Düşük Risk' | 'Orta Risk' | 'Yüksek Risk' | 'Kritik Risk';
  if (clampedScore >= 70) {
    levelTr = 'Kritik Risk';
  } else if (clampedScore >= 45) {
    levelTr = 'Yüksek Risk';
  } else if (clampedScore >= 20) {
    levelTr = 'Orta Risk';
  } else {
    levelTr = 'Düşük Risk';
  }

  const explanationTr =
    `Bu puan (${clampedScore}/100), kaynak metinde kanıtı doğrulanmış ${verifiedFindings.length} adet potansiyel risk maddesinin ` +
    `deterministik ağırlıklandırılmasıyla hesaplanmıştır. Bu skor şirketin kötü niyetli olduğunu veya kesin zarar göreceğinizi göstermez; ` +
    `yalnızca kullanıcı aleyhine olabilecek tipik sözleşme maddelerinin yoğunluğuna işaret eder.`;

  return {
    score: clampedScore,
    levelTr,
    explanationTr,
  };
}
