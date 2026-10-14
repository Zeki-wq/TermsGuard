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

// 6502 Sayılı Tüketici Kanunu & KVKK Mevzuat Eşleşmeleri
export const LEGAL_COMPLIANCE_TR: Record<RiskCategory, { law: string; clause: string; noteTr: string }> = {
  arbitration_jurisdiction: {
    law: '6502 s. Tüketici Kanunu',
    clause: 'Md. 5 (Haksız Şartlar)',
    noteTr: 'Tüketicinin yasal yargı mercilerine başvurmasını engelleyen veya zorlaştıran tahkim şartları kesin olarak hükümsüzdür.',
  },
  unilateral_changes: {
    law: '6502 s. Tüketici Kanunu',
    clause: 'Md. 5/2 (Haksız Şartlar Yönetmeliği)',
    noteTr: 'Haklı bir gerekçe olmaksızın sözleşme şartlarının tek taraflı değiştirilmesi tüketici aleyhine haksız şart sayılır.',
  },
  liability_limitation: {
    law: '6098 s. TBK & 6502 s. Kanun',
    clause: 'TBK Md. 115 & TKHK Md. 5',
    noteTr: 'Ağır kusur veya can/mal güvenliği zararlarında sorumluluğu peşinen kaldıran anlaşmalar batıldır.',
  },
  data_sharing_privacy: {
    law: '6698 s. KVKK',
    clause: 'Md. 5, 8 & 9 (Kişisel Verilerin Aktarımı)',
    noteTr: 'Açık rıza olmaksızın kişisel verilerin yurt içine veya yurt dışındaki üçüncü taraflara aktarılması hukuka aykırıdır.',
  },
  ip_content_rights: {
    law: '5846 s. FSEK',
    clause: 'Md. 48 & 52 (Mali Hakların Devri)',
    noteTr: 'Fikri mülkiyet haklarının bedelsiz, sınırsız ve gelecekteki eserleri kapsayacak şekilde toptan devri geçersizdir.',
  },
  payment_auto_renewal: {
    law: 'Abonelik Sözleşmeleri Yönetmeliği',
    clause: 'Md. 13 & 14 (Süre Uzatımı ve İptal)',
    noteTr: 'Tüketiciye açık bilgilendirme yapılmadan ve kolay iptal hakkı sunulmadan otomatik para çekilmesi yasaktır.',
  },
  cancellation_termination: {
    law: '6502 s. Tüketici Kanunu',
    clause: 'Md. 52 (Abonelikten Ayrılma Hakkı)',
    noteTr: 'Tüketici, aboneliğini dilediği anda feshetme hakkına sahiptir; zorlaştırıcı koşul veya ceza koşulu konulamaz.',
  },
  waive_class_action: {
    law: 'Anayasa & HMK',
    clause: 'Anayasa Md. 36 (Hak Arama Hürriyeti)',
    noteTr: 'Toplu dava veya temsil hakkından önceden feragat edilmesi temel hak arama hürriyetine aykırıdır.',
  },
  other_risk: {
    law: '6098 s. Türk Borçlar Kanunu',
    clause: 'Genel İşlem Koşulları (Md. 20-25)',
    noteTr: 'Dürüstlük kuralına aykırı olarak tüketici aleyhine tek taraflı dengesizlik yaratan hükümler yazılmamış sayılır.',
  },
};

export interface BenchmarkService {
  name: string;
  score: number;
  category: string;
}

export const BENCHMARK_SERVICES: BenchmarkService[] = [
  { name: 'Apple Servisleri', score: 62, category: 'Donanım & Bulut' },
  { name: 'Spotify Premium', score: 70, category: 'Müzik & Yayın' },
  { name: 'Netflix', score: 68, category: 'Video Akış' },
  { name: 'GitHub', score: 59, category: 'Yazılım & Kod' },
  { name: 'Discord', score: 93, category: 'Topluluk & İletişim' },
  { name: 'OpenAI (ChatGPT)', score: 88, category: 'Yapay Zeka' },
];

export interface QAAnswer {
  question: string;
  answerTr: string;
  relevantQuote?: string;
  foundInSource: boolean;
}

