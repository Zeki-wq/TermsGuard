import React, { useState, useEffect } from 'react';
import {
  RiskReport,
  RiskFinding,
  CATEGORY_LABELS_TR,
  SEVERITY_LABELS_TR,
  MANDATORY_LEGAL_DISCLAIMER,
} from '../shared/types';
import { getSettings, saveSettings, getLatestReport } from '../shared/storage';
import { Shield, Settings, AlertTriangle, CheckCircle, RefreshCw, Copy, Check, Download } from 'lucide-react';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [report, setReport] = useState<RiskReport | null>(null);
  const [pageInfo, setPageInfo] = useState<{ title: string; domain: string; url: string; documentType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => {
    // Load cached report if any
    getLatestReport().then((cached) => {
      if (cached) setReport(cached);
    });

    // Query active tab info
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab) {
          const urlObj = tab.url ? new URL(tab.url) : null;
          setPageInfo({
            title: tab.title || 'Mevcut Sekme',
            url: tab.url || '',
            domain: urlObj ? urlObj.hostname : 'Bilinmeyen Alan Adı',
            documentType: tab.title?.toLowerCase().includes('gizlilik') || tab.title?.toLowerCase().includes('privacy')
              ? 'Gizlilik Politikası'
              : 'Kullanım Koşulları',
          });
        }
      });
    } else {
      // Mock tab info for Cypress / standalone dev
      setPageInfo({
        title: 'Örnek Kullanım Koşulları ve Gizlilik Sözleşmesi',
        domain: 'example-service.com',
        url: 'https://example-service.com/terms',
        documentType: 'Kullanım Koşulları',
      });
    }
  }, []);

  const handleStartAnalysis = async () => {
    setError(null);
    const settings = await getSettings();

    if (!settings.dataConsentGranted && settings.provider !== 'mock') {
      setShowConsentModal(true);
      return;
    }

    executeAnalysis();
  };

  const handleConfirmConsent = async () => {
    await saveSettings({ dataConsentGranted: true });
    setShowConsentModal(false);
    executeAnalysis();
  };

  const executeAnalysis = () => {
    setLoading(true);
    setStatusMessage('Sayfadaki görünür metinler taranıyor...');

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      setTimeout(() => setStatusMessage('Model analiz isteği işleniyor...'), 700);
      setTimeout(() => setStatusMessage('Alıntılar kaynak metinle doğrulanıyor...'), 1800);

      chrome.runtime.sendMessage({ type: 'START_ANALYSIS' }, (response) => {
        setLoading(false);
        if (!response) {
          setError('Arka plan servisi yanıt vermedi.');
          return;
        }
        if (!response.success) {
          if (response.needsConsent) {
            setShowConsentModal(true);
          } else {
            setError(response.error || 'Analiz sırasında bilinmeyen bir hata oluştu.');
          }
          return;
        }
        setReport(response.report);
      });
    } else {
      // Fallback for Cypress/local testing without chrome runtime
      setTimeout(async () => {
        try {
          const settings = await getSettings();
          const { extractPageDocument } = await import('../shared/extraction/extractor');
          const { runAnalysisPipeline } = await import('../shared/pipeline');
          const extracted = extractPageDocument(document);

          let provider;
          if (settings.provider === 'mock') {
            const { DeterministicMockAdapter } = await import('../shared/providers/mock-adapter');
            const hasFabricatedTest = extracted.rawText.includes('TEST_FABRICATED_QUOTE');
            provider = new DeterministicMockAdapter({ injectFabricatedQuote: hasFabricatedTest });
          } else {
            const { OpenAICompatibleAdapter } = await import('../shared/providers/openai-adapter');
            provider = new OpenAICompatibleAdapter(settings.endpoint, settings.model, settings.apiKey);
          }

          const rep = await runAnalysisPipeline({ provider, document: extracted });
          if (rep.analysisStatus === 'failed') {
            setError(rep.scoreExplanation);
          } else {
            setReport(rep);
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      }, 500);
    }
  };

  const handleCopyQuote = (quote: string, id: string) => {
    navigator.clipboard.writeText(quote);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyReport = () => {
    if (!report) return;
    const lines = [
      `TERMSGUARD RİSK ANALİZ RAPORU`,
      `Belge: ${report.document.title} (${report.document.domain})`,
      `Belge Türü: ${report.document.documentType}`,
      `Risk Skoru: ${report.overallRiskScore}/100`,
      `Durum: ${report.analysisStatus}`,
      `Açıklama: ${report.scoreExplanation}`,
      ``,
      `DOĞRULANMIŞ BULGULAR (${report.findings.length}):`,
      ...report.findings.map(
        (f, idx) =>
          `${idx + 1}. [${SEVERITY_LABELS_TR[f.severity] || f.severity}] ${CATEGORY_LABELS_TR[f.category] || f.category}\n` +
          `   Alıntı: "${f.originalQuote}"\n` +
          `   Açıklama: ${f.explanationTr}\n` +
          `   Neden Önemli: ${f.whyItMattersTr}\n`
      ),
      ``,
      `YASAL UYARI:`,
      report.disclaimer,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TermsGuard_${report.document.domain || 'report'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/src/options/index.html', '_blank');
    }
  };

  const getScoreDialClass = (score: number) => {
    if (score >= 70) return 'critical';
    if (score >= 45) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <Shield className="brand-icon" />
          <span className="brand-title">TermsGuard</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            id="open-settings-btn"
            title="Ayarlar"
            onClick={openOptions}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="content-body">
        {/* Page Context Card */}
        {pageInfo && (
          <div className="meta-card" id="page-context-card">
            <div className="meta-row">
              <span className="meta-label">Web Sitesi:</span>
              <span className="meta-value" id="page-domain">{pageInfo.domain}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Belge Türü:</span>
              <span className="badge badge-blue" id="doc-type-badge">
                {report ? report.document.documentType : pageInfo.documentType}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          className="btn-primary"
          id="analyze-page-btn"
          disabled={loading}
          onClick={handleStartAnalysis}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>{statusMessage}</span>
            </>
          ) : (
            <>
              <Shield size={16} />
              <span>Sayfayı Analiz Et</span>
            </>
          )}
        </button>

        {/* Error Alert */}
        {error && (
          <div className="uncertainty-box" id="error-alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Analiz Başarısız:</strong>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Report Presentation */}
        {report && (
          <div id="risk-report-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Score Banner */}
            <div className="score-banner" id="score-banner">
              <div className={`score-dial ${getScoreDialClass(report.overallRiskScore)}`} id="score-dial">
                {report.overallRiskScore}
              </div>
              <div className="score-info">
                <div className="score-title" id="score-level-text">
                  {report.overallRiskScore >= 70
                    ? 'Kritik Riskli Sözleşme'
                    : report.overallRiskScore >= 45
                    ? 'Yüksek Riskli Sözleşme'
                    : report.overallRiskScore >= 20
                    ? 'Orta Seviye Risk'
                    : 'Düşük Riskli'}
                </div>
                <div className="score-sub">{report.scoreExplanation}</div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-num" id="verified-count">{report.findings.length}</div>
                <div className="stat-label">Doğrulanan Kanıt</div>
              </div>
              <div className="stat-box">
                <div className="stat-num" id="rejected-count" style={{ color: report.rejectedFindings.length > 0 ? '#fca5a5' : '#94a3b8' }}>
                  {report.rejectedFindings.length}
                </div>
                <div className="stat-label">Reddedilen İddia</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">
                  <span className={`badge ${report.coverage.completeness === 'complete' ? 'badge-green' : 'badge-yellow'}`} id="coverage-badge">
                    {report.coverage.completeness === 'complete' ? 'Tam' : report.coverage.completeness === 'partial' ? 'Kısmi' : 'Yetersiz'}
                  </span>
                </div>
                <div className="stat-label">Kapsam Durumu</div>
              </div>
            </div>

            {/* Uncertainties and Warnings */}
            {report.uncertainties.length > 0 && (
              <div className="uncertainty-box" id="uncertainties-card">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Belirsizlik ve Uyarı Bildirimi:</strong>
                  <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                    {report.uncertainties.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Verified Findings Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} id="findings-list">
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#93c5fa' }}>
                Doğrulanmış Risk Maddeleri ({report.findings.length})
              </h4>

              {report.findings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                  Doğrulanmış risk maddesi bulunamadı.
                </div>
              )}

              {report.findings.map((f: RiskFinding) => (
                <div className="finding-card" key={f.id} id={`finding-${f.id}`}>
                  <div className="finding-header">
                    <span className="finding-category">
                      {CATEGORY_LABELS_TR[f.category] || f.category}
                    </span>
                    <span
                      className={`badge ${
                        f.severity === 'critical'
                          ? 'badge-red'
                          : f.severity === 'high'
                          ? 'badge-red'
                          : f.severity === 'medium'
                          ? 'badge-yellow'
                          : 'badge-blue'
                      }`}
                    >
                      {SEVERITY_LABELS_TR[f.severity] || f.severity}
                    </span>
                  </div>

                  {/* Verbatim Evidence Box */}
                  <div className="evidence-box">
                    <button
                      className="icon-btn copy-quote-btn"
                      title="Alıntıyı Kopyala"
                      onClick={() => handleCopyQuote(f.originalQuote, f.id)}
                    >
                      {copiedId === f.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                    "{f.originalQuote}"
                  </div>

                  <div className="finding-explanation">
                    {f.explanationTr}
                  </div>

                  <div className="why-it-matters">
                    <strong>Neden Önemli? </strong>
                    {f.whyItMattersTr}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                      <CheckCircle size={12} /> Doğrulanmış Kanıt
                    </span>
                    <button
                      style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '11px' }}
                      onClick={() => setExpandedFindingId(expandedFindingId === f.id ? null : f.id)}
                    >
                      {expandedFindingId === f.id ? 'Bağlamı Gizle' : 'Kaynak Konumunu Gör'}
                    </button>
                  </div>

                  {expandedFindingId === f.id && (
                    <div style={{ fontSize: '11px', background: '#090d16', padding: '8px', borderRadius: '4px', color: '#94a3b8' }}>
                      Bölüm: <code>{f.sourceChunkId}</code> | Karakter aralığı: [{f.sourceStartOffset} - {f.sourceEndOffset}]
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Rejected Findings Accordion (Integrity Transparency) */}
            {report.rejectedFindings.length > 0 && (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  onClick={() => setShowRejected(!showRejected)}
                  id="toggle-rejected-btn"
                >
                  <span style={{ color: '#fca5a5' }}>
                    Reddedilen İddialar ({report.rejectedFindings.length})
                  </span>
                  <span>{showRejected ? '▲' : '▼'}</span>
                </div>
                {showRejected && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }} id="rejected-findings-list">
                    <p style={{ color: '#94a3b8' }}>
                      Aşağıdaki maddeler model tarafından öne sürülmüş ancak kaynak metinde bulunamadığı, mükerrer olduğu veya doğrulanabilir kanıt içermediği için <strong>skora dahil edilmemiştir</strong>:
                    </p>
                    {report.rejectedFindings.map((rf, idx) => (
                      <div key={idx} style={{ background: '#090d16', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid #ef4444' }}>
                        <div style={{ color: '#f8fafc', fontStyle: 'italic' }}>"{rf.originalQuote}"</div>
                        <div style={{ color: '#fca5a5', marginTop: '2px' }}>Gerekçe: {rf.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Export and Action Bar */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                id="copy-report-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleCopyReport}
              >
                {reportCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{reportCopied ? 'Kopyalandı' : 'Raporu Kopyala'}</span>
              </button>
              <button
                className="btn-secondary"
                id="download-json-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleDownloadJson}
              >
                <Download size={14} />
                <span>JSON İndir</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Legal Disclaimer */}
      <footer className="footer-disclaimer" id="mandatory-disclaimer">
        {MANDATORY_LEGAL_DISCLAIMER}
      </footer>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="modal-overlay" id="consent-modal">
          <div className="modal-card">
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Veri İletimi Onayı</h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
              TermsGuard, açık olan sayfadaki yasal sözleşme metnini analiz edebilmek için <strong>kendi yapılandırdığınız LLM sağlayıcısına</strong> iletir.
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
              Sayfadaki metin dışında şifreler, çerezler veya kimlik bilgileri asla okunmaz ve iletilmez. Bu işlem yalnızca siz "Sayfayı Analiz Et" düğmesine bastığınızda gerçekleşir.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowConsentModal(false)}
              >
                İptal
              </button>
              <button
                className="btn-primary"
                id="confirm-consent-btn"
                onClick={handleConfirmConsent}
              >
                Onaylıyorum ve Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
