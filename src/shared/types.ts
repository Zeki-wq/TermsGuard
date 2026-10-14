export type RiskCategory =
  | 'arbitration_jurisdiction'
  | 'unilateral_changes'
  | 'data_sharing_privacy'
  | 'liability_limitation'
  | 'ip_content_rights'
  | 'payment_auto_renewal'
  | 'cancellation_termination'
  | 'waive_class_action'
  | 'other_risk';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type VerificationStatus = 'verified' | 'unverified' | 'rejected';

export type AnalysisStatus = 'success' | 'uncertain' | 'incomplete' | 'failed';

export type CoverageCompleteness = 'complete' | 'partial' | 'insufficient';

export interface SourceChunk {
  chunkId: string;
  text: string;
  startOffset: number;
  endOffset: number;
  sectionHeading?: string;
}

export interface ExtractedDocument {
  title: string;
  url: string;
  domain: string;
  documentType: string;
  rawText: string;
  characterCount: number;
  chunks: SourceChunk[];
  isTruncated: boolean;
  extractionNotice?: string;
  timestamp: string;
}

export interface RiskFinding {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  originalQuote: string;
  explanationTr: string;
  whyItMattersTr: string;
  sourceChunkId: string;
  sourceStartOffset: number;
  sourceEndOffset: number;
  confidence: number;
  verificationStatus: 'verified';
}

export interface RejectedFinding {
  originalQuote: string;
  reason: string;
  claimedCategory: string;
  claimedSeverity: string;
}

export interface CoverageInfo {
  completeness: CoverageCompleteness;
  explanationTr: string;
  truncated: boolean;
}

export interface RiskReport {
  schemaVersion: string;
  document: {
    title: string;
    url: string;
    domain: string;
    documentType: string;
    characterCount: number;
    chunkCount: number;
  };
  analysisStatus: AnalysisStatus;
  overallRiskScore: number;
  scoreExplanation: string;
  coverage: CoverageInfo;
  findings: RiskFinding[];
  rejectedFindings: RejectedFinding[];
  uncertainties: string[];
  disclaimer: string;
}

export interface LLMCandidateFinding {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  originalQuote: string;
  explanationTr: string;
  whyItMattersTr: string;
  sourceChunkId?: string;
  confidence?: number;
}

export interface RawLLMResponse {
  documentType?: string;
  summaryTr: string;
  findings: LLMCandidateFinding[];
  uncertainties: string[];
}

export interface LLMSettings {
  provider: 'openai' | 'mock';
  endpoint: string;
  model: string;
  apiKey: string;
  dataConsentGranted: boolean;
  timeoutMs?: number;
}

export const MANDATORY_LEGAL_DISCLAIMER =
  'TermsGuard bilgilendirme amaçlıdır; hukuki tavsiye vermez. Analizler otomatik ve hatalı olabilir. Önemli kararlar için orijinal sözleşmeyi inceleyin ve gerektiğinde bir hukuk uzmanına danışın.';

export const SEVERITY_WEIGHTS: Record<RiskSeverity, number> = {
  low: 10,
  medium: 25,
  high: 45,
  critical: 60,
};

export const CATEGORY_LABELS_TR: Record<RiskCategory, string> = {
  arbitration_jurisdiction: 'Tahkim ve Yargı Yetkisi',
  unilateral_changes: 'Tek Taraflı Değişiklik Hakkı',
  data_sharing_privacy: 'Veri Paylaşımı ve Gizlilik',
  liability_limitation: 'Sorumluluk Reddi ve Sınırlandırması',
  ip_content_rights: 'Fikri Mülkiyet ve İçerik Hakları Devri',
  payment_auto_renewal: 'Ödeme ve Otomatik Yenileme',
  cancellation_termination: 'İptal ve Fesih Kısıtlamaları',
  waive_class_action: 'Toplu Dava Hakkından Feragat',
  other_risk: 'Diğer Hukuki ve Finansal Riskler',
};

export const SEVERITY_LABELS_TR: Record<RiskSeverity, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};
