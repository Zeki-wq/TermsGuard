import { RawLLMResponse, LLMCandidateFinding, RiskCategory } from '../types';
import { LLMProvider, ProviderRequestOptions } from './types';

export interface MockAdapterOptions {
  injectFabricatedQuote?: boolean;
  injectZeroScoreAttempt?: boolean;
  simulateTimeout?: boolean;
  simulateInvalidJson?: boolean;
}

/**
 * Deterministic Mock Adapter for unit testing, CI, and explicitly labeled offline demonstrations.
 * Never used as a silent production fallback.
 */
export class DeterministicMockAdapter implements LLMProvider {
  readonly name = 'Deterministic-Mock-Provider (Test & Offline Demo Only)';
  private options: MockAdapterOptions;

  constructor(options: MockAdapterOptions = {}) {
    this.options = options;
  }

  async analyze(documentText: string, options?: ProviderRequestOptions): Promise<RawLLMResponse> {
    if (this.options.simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error('İstek zaman aşımına uğradı (Simüle edilmiş test zaman aşımı).');
    }

    if (this.options.simulateInvalidJson) {
      throw new Error('Model çıktısı şema kurallarını karşılamadı: root missing required property findings');
    }

    const findings: LLMCandidateFinding[] = [];
    const lower = documentText.toLowerCase();

    // Pattern definitions to locate real sentences in the given document text
    const detectionRules: Array<{
      category: RiskCategory;
      severity: 'low' | 'medium' | 'high' | 'critical';
      keywords: string[];
      explanationTr: string;
      whyItMattersTr: string;
    }> = [
      {
        category: 'arbitration_jurisdiction',
        severity: 'high',
        keywords: ['arbitration', 'tahkim', 'binding arbitration', 'zorunlu tahkim'],
        explanationTr: 'Kullanıcının mahkemeye başvurma hakkını sınırlandırıp zorunlu tahkimi zorunlu kılan madde.',
        whyItMattersTr: 'Bir uyuşmazlık halinde tüketici mahkemeleri yerine pahalı ve taraflı olabilen tahkim süreçlerine mecbur bırakılabilirsiniz.',
      },
      {
        category: 'unilateral_changes',
        severity: 'medium',
        keywords: ['modify these terms', 'değiştirme hakkı', 'right to modify', 'update these terms without notice'],
        explanationTr: 'Şirketin sözleşme koşullarını önceden haber vermeksizin tek taraflı değiştirme hakkı saklı tutuluyor.',
        whyItMattersTr: 'Kullanım koşulları veya ücretlendirme siz farkında olmadan aleyhinize değişebilir.',
      },
      {
        category: 'liability_limitation',
        severity: 'high',
        keywords: ['limitation of liability', 'sorumluluk reddi', 'as is', 'in no event shall', 'hiçbir durumda sorumlu'],
        explanationTr: 'Hizmet kesintisi veya veri kaybı durumlarında şirketin yasal sorumluluğunu tamamen veya büyük oranda reddettiği madde.',
        whyItMattersTr: 'Hizmet kaynaklı bir zarara uğrarsanız veya veriniz kaybolursa tazminat talep etmeniz engellenebilir.',
      },
      {
        category: 'waive_class_action',
        severity: 'critical',
        keywords: ['class action', 'toplu dava', 'class action waiver', 'toplu dava feragati'],
        explanationTr: 'Toplu dava veya grup temsili yoluyla hak arama hakkından feragat maddesi.',
        whyItMattersTr: 'Küçük meblağlı mağduriyetlerde tek başınıza dava açmanız ekonomik olmayacağı için hakkınızı aramanız fiilen engellenir.',
      },
      {
        category: 'ip_content_rights',
        severity: 'medium',
        keywords: ['worldwide, royalty-free', 'telifsiz lisans', 'license to your content', 'içeriğiniz üzerinde lisans'],
        explanationTr: 'Platforma yüklediğiniz içerikler üzerinde şirkete dünya çapında, geri alınamaz ve ücretsiz kullanım hakkı veren madde.',
        whyItMattersTr: 'Ürettiğiniz eser veya veriler ticari amaçlarla bilginiz dışında kullanılabilir.',
      },
      {
        category: 'payment_auto_renewal',
        severity: 'high',
        keywords: ['automatically renew', 'otomatik yenilenir', 'recurring subscription', 'non-refundable', 'iade edilmez'],
        explanationTr: 'Aboneliğin otomatik yenilenmesi veya iptal/iade hakkının kısıtlandığı ödeme maddesi.',
        whyItMattersTr: 'Hizmeti kullanmasanız dahi iptal etmeyi unuttuğunuzda kartınızdan otomatik tahsilat yapılabilir.',
      },
      {
        category: 'cancellation_termination',
        severity: 'medium',
        keywords: ['terminate your account', 'hesabınızı askıya alma', 'sole discretion', 'tamamen kendi takdirinde'],
        explanationTr: 'Şirketin herhangi bir gerekçe göstermeksizin hesabınızı kapatabileceğini veya hizmeti kesebileceğini belirten madde.',
        whyItMattersTr: 'Yatırım yaptığınız veya veri depoladığınız bir hesaba erişiminiz aniden ve gerekçesiz sonlandırılabilir.',
      },
    ];

    let findingCounter = 1;

    for (const rule of detectionRules) {
      for (const kw of rule.keywords) {
        const kwIdx = lower.indexOf(kw);
        if (kwIdx !== -1) {
          // Extract sentence around keyword
          const startSentence = Math.max(0, documentText.lastIndexOf('.', kwIdx) + 1);
          let endSentence = documentText.indexOf('.', kwIdx + kw.length);
          if (endSentence === -1) endSentence = Math.min(documentText.length, kwIdx + 200);
          else endSentence = endSentence + 1;

          const exactExcerpt = documentText.substring(startSentence, endSentence).trim();
          if (exactExcerpt.length >= 20) {
            findings.push({
              id: `mock_f_${findingCounter++}`,
              category: rule.category,
              severity: rule.severity,
              originalQuote: exactExcerpt,
              explanationTr: rule.explanationTr,
              whyItMattersTr: rule.whyItMattersTr,
              confidence: 0.95,
            });
            break; // Move to next rule
          }
        }
      }
    }

    // Adversarial simulation flags
    if (this.options.injectFabricatedQuote) {
      findings.push({
        id: `mock_fabricated_${findingCounter++}`,
        category: 'liability_limitation',
        severity: 'critical',
        originalQuote: 'This completely fabricated sentence does not exist anywhere in the extracted document text at all.',
        explanationTr: 'Uydurma kanıt testi maddesi.',
        whyItMattersTr: 'Bu madde kaynak metinde olmadığı için kanıt doğrulayıcı tarafından reddedilmelidir.',
        confidence: 0.99,
      });
    }

    const uncertainties: string[] = [];
    if (documentText.length < 500) {
      uncertainties.push('Belge uzunluğu standart bir yasal sözleşme için oldukça kısadır. Eksik maddeler bulunabilir.');
    }

    return {
      documentType: options?.title?.toLowerCase().includes('privacy') ? 'Gizlilik Politikası' : 'Kullanım Koşulları',
      summaryTr: `Bu metin ${findings.length} adet potansiyel risk maddesi içeren otomatik test/mock analiz çıktısıdır.`,
      findings,
      uncertainties,
    };
  }
}
