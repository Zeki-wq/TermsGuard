import {
  ExtractedDocument,
  RiskReport,
  MANDATORY_LEGAL_DISCLAIMER,
  CoverageCompleteness,
  AnalysisStatus,
} from './types';
import { LLMProvider } from './providers/types';
import { scanForPromptInjection } from './providers/injection-defense';
import { verifyFindings } from './evidence/verifier';
import { calculateRiskScore } from './scoring/calculator';
import { validateRiskReport } from './schema/validator';

export interface PipelineOptions {
  provider: LLMProvider;
  document: ExtractedDocument;
}

export async function runAnalysisPipeline({
  provider,
  document,
}: PipelineOptions): Promise<RiskReport> {
  const { rawText, chunks, title, url, domain, documentType, characterCount, isTruncated } =
    document;

  // Step 1: Coverage Check
  let completeness: CoverageCompleteness = 'complete';
  let coverageExplanation = 'Belge metni başarıyla çıkarıldı ve analiz için işlendi.';

  if (characterCount < 250) {
    completeness = 'insufficient';
    coverageExplanation =
      'Sayfa içeriğinde yeterli yasal metin tespit edilemedi (250 karakterden az). Sayfa içeriği oturum açma, iframe veya dinamik yükleme arkasında olabilir.';
  } else if (isTruncated) {
    completeness = 'partial';
    coverageExplanation =
      'Belge boyutu güvenlik sınırını aştığı için kısmi olarak analiz edildi. Kalan kısımlarda bildirilmemiş maddeler olabilir.';
  }

  // Step 2: Layered Prompt Injection Scan
  const injectionScan = scanForPromptInjection(rawText);
  const uncertainties: string[] = [];
  if (injectionScan.hasSuspiciousDirectives && injectionScan.sanitizedNoticeTr) {
    uncertainties.push(injectionScan.sanitizedNoticeTr);
  }

  // If text is insufficient, return safe early report
  if (completeness === 'insufficient') {
    const insufficientReport: RiskReport = {
      schemaVersion: '1.0.0',
      document: {
        title,
        url,
        domain,
        documentType,
        characterCount,
        chunkCount: chunks.length,
      },
      analysisStatus: 'incomplete',
      overallRiskScore: 0,
      scoreExplanation:
        'Yetersiz veri: Sayfada analiz edilecek yeterli yasal metin bulunamadı. Genel risk skoru hesaplanamaz.',
      coverage: {
        completeness: 'insufficient',
        explanationTr: coverageExplanation,
        truncated: false,
      },
      findings: [],
      rejectedFindings: [],
      uncertainties: ['Sayfada yeterli yasal metin tespit edilemedi veya metin yüklenemedi.'],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    };
    return insufficientReport;
  }

  // Step 3: LLM Provider Execution
  let rawLLMResponse;
  try {
    rawLLMResponse = await provider.analyze(rawText, {
      title,
      domain,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failedReport: RiskReport = {
      schemaVersion: '1.0.0',
      document: {
        title,
        url,
        domain,
        documentType,
        characterCount,
        chunkCount: chunks.length,
      },
      analysisStatus: 'failed',
      overallRiskScore: 0,
      scoreExplanation: `Analiz gerçekleştirilemedi: ${errorMsg}`,
      coverage: {
        completeness,
        explanationTr: coverageExplanation,
        truncated: isTruncated,
      },
      findings: [],
      rejectedFindings: [],
      uncertainties: [`Sağlayıcı hatası: ${errorMsg}`],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    };
    return failedReport;
  }

  // Append LLM uncertainties if provided
  if (Array.isArray(rawLLMResponse.uncertainties)) {
    for (const u of rawLLMResponse.uncertainties) {
      if (typeof u === 'string' && u.trim().length > 0 && !uncertainties.includes(u)) {
        uncertainties.push(u);
      }
    }
  }

  // Step 4: Strict Deterministic Evidence Verification
  const verification = verifyFindings(rawLLMResponse.findings || [], rawText, chunks);

  // Step 5: Deterministic Risk Scoring
  const scoreResult = calculateRiskScore(verification.verifiedFindings, false);

  // Step 6: Determine Analysis Status
  let analysisStatus: AnalysisStatus = completeness === 'partial' ? 'uncertain' : 'success';
  if (verification.rejectedFindings.length > verification.verifiedFindings.length && verification.rejectedFindings.length > 0) {
    analysisStatus = 'uncertain';
  }

  // Step 7: Assemble Final Report
  const finalReport: RiskReport = {
    schemaVersion: '1.0.0',
    document: {
      title,
      url,
      domain,
      documentType: rawLLMResponse.documentType || documentType,
      characterCount,
      chunkCount: chunks.length,
    },
    analysisStatus,
    overallRiskScore: scoreResult.score,
    scoreExplanation: scoreResult.explanationTr,
    coverage: {
      completeness,
      explanationTr: coverageExplanation,
      truncated: isTruncated,
    },
    findings: verification.verifiedFindings,
    rejectedFindings: verification.rejectedFindings,
    uncertainties,
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
  };

  // Step 8: Validate the generated report against strict JSON schema
  const validation = validateRiskReport(finalReport);
  if (!validation.valid) {
    console.error('Final report validation errors:', validation.errors);
    throw new Error(`Oluşturulan nihai rapor JSON Şemasına uymuyor:\n${(validation.errors || []).join('\n')}`);
  }

  return finalReport;
}
