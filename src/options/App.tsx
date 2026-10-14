import React, { useState, useEffect } from 'react';
import { LLMSettings } from '../shared/types';
import { getSettings, saveSettings, clearAllExtensionData, maskApiKey } from '../shared/storage';
import { Shield, Save, Trash2, Eye, EyeOff } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettingsState] = useState<LLMSettings>({
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    dataConsentGranted: false,
  });

  const [showKey, setShowKey] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    getSettings().then((loaded) => setSettingsState(loaded));
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      await saveSettings(settings);
      setAlert({ type: 'success', message: 'Ayarlar başarıyla kaydedildi.' });
      setTimeout(() => setAlert(null), 3000);
    } catch (err: unknown) {
      setAlert({ type: 'error', message: `Kaydetme hatası: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  const handleDeleteKey = async () => {
    const updated = { ...settings, apiKey: '' };
    setSettingsState(updated);
    await saveSettings(updated);
    setAlert({ type: 'success', message: 'API Anahtarı silindi.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleClearAll = async () => {
    if (window.confirm('Tüm kayıtlı ayarlar, API anahtarı ve rapor geçmişi silinecektir. Emin misiniz?')) {
      await clearAllExtensionData();
      const fresh = await getSettings();
      setSettingsState(fresh);
      setAlert({ type: 'success', message: 'Tüm yerel veriler temizlendi.' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setAlert(null);

    try {
      if (settings.provider === 'mock') {
        const { DeterministicMockAdapter } = await import('../shared/providers/mock-adapter');
        const mock = new DeterministicMockAdapter();
        await mock.analyze('Sample terms text for testing connection.');
        setAlert({ type: 'success', message: 'Mock sağlayıcı bağlantı testi başarılı.' });
      } else {
        if (!settings.apiKey) {
          throw new Error('Önce bir API anahtarı girmelisiniz.');
        }
        const { OpenAICompatibleAdapter } = await import('../shared/providers/openai-adapter');
        const adapter = new OpenAICompatibleAdapter(settings.endpoint, settings.model, settings.apiKey);
        // Minimal test payload
        await adapter.analyze('This is a short contract clause stating that users may cancel anytime.');
        setAlert({ type: 'success', message: 'Sağlayıcı bağlantısı ve şema doğrulaması başarılı!' });
      }
    } catch (err: unknown) {
      setAlert({ type: 'error', message: `Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTestingConnection(false);
      setTimeout(() => setAlert(null), 5000);
    }
  };

  return (
    <div className="options-container">
      <div className="options-header">
        <Shield size={28} color="#60a5fa" />
        <h1 className="options-title">TermsGuard Yapılandırma ve Ayarlar</h1>
      </div>

      {alert && (
        <div className={`save-alert ${alert.type}`} id="status-alert">
          {alert.message}
        </div>
      )}

      {/* Provider Configuration */}
      <div className="section-card">
        <h2 className="section-title">LLM Sağlayıcı Seçimi (BYOK - Kendi Anahtarını Getir)</h2>

        <div className="form-group">
          <label className="form-label" htmlFor="provider-select">Sağlayıcı Türü</label>
          <select
            id="provider-select"
            className="form-select"
            value={settings.provider}
            onChange={(e) => setSettingsState({ ...settings, provider: e.target.value as 'openai' | 'mock' })}
          >
            <option value="openai">OpenAI Uyumlu API (Önerilen: OpenAI, Groq, DeepSeek, OpenRouter, Ollama)</option>
            <option value="mock">Deterministik Mock Sağlayıcı (Yalnızca Test ve Çevrimdışı Demo İçin)</option>
          </select>
          {settings.provider === 'mock' && (
            <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
              ⚠️ Dikkat: Mock sağlayıcı yalnızca otomatik testler ve çevrimdışı gösterim içindir. Gerçek üretim analizi yapmaz.
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="endpoint-input">API Uç Noktası (Base URL)</label>
          <input
            id="endpoint-input"
            type="text"
            className="form-input"
            placeholder="https://api.openai.com/v1"
            value={settings.endpoint}
            disabled={settings.provider === 'mock'}
            onChange={(e) => setSettingsState({ ...settings, endpoint: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="model-input">Model Adı</label>
          <input
            id="model-input"
            type="text"
            className="form-input"
            placeholder="gpt-4o-mini"
            value={settings.model}
            disabled={settings.provider === 'mock'}
            onChange={(e) => setSettingsState({ ...settings, model: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="apikey-input">API Anahtarı (API Key)</label>
          <div className="input-with-button">
            <input
              id="apikey-input"
              type={showKey ? 'text' : 'password'}
              className="form-input"
              style={{ flex: 1 }}
              placeholder={settings.apiKey ? maskApiKey(settings.apiKey) : 'sk-...'}
              value={settings.apiKey}
              disabled={settings.provider === 'mock'}
              onChange={(e) => setSettingsState({ ...settings, apiKey: e.target.value })}
            />
            <button
              type="button"
              className="btn-secondary"
              id="toggle-key-visibility-btn"
              onClick={() => setShowKey(!showKey)}
              disabled={settings.provider === 'mock'}
              title={showKey ? 'Gizle' : 'Göster'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              className="btn-danger"
              id="delete-key-btn"
              onClick={handleDeleteKey}
              disabled={!settings.apiKey}
              title="API Anahtarını Sil"
            >
              <Trash2 size={16} /> Sil
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Mevcut Durum: <strong>{maskApiKey(settings.apiKey)}</strong>
          </div>
        </div>
      </div>

      {/* Privacy and Data Transmission */}
      <div className="section-card">
        <h2 className="section-title">Gizlilik ve Veri İşleme Tercihleri</h2>

        <div className="notice-box">
          <p>
            <strong>Veri Güvenliği Taahhüdü:</strong> TermsGuard, sayfa metinlerini veya API anahtarınızı asla merkezi bir sunucuya, üçüncü taraf veri tabanına veya analitik servisine göndermez. API anahtarınız yalnızca tarayıcınızın yerel depolama alanında (<code>chrome.storage.local</code>) tutulur.
          </p>
          <p style={{ marginTop: '8px' }}>
            Analiz düğmesine bastığınızda, aktif sayfadan çıkarılan yasal metin yalnızca yukarıda yapılandırdığınız uç noktaya (LLM Sağlayıcısına) iletilir.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id="consent-checkbox"
            checked={settings.dataConsentGranted}
            onChange={(e) => setSettingsState({ ...settings, dataConsentGranted: e.target.checked })}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="consent-checkbox" style={{ fontSize: '13px', cursor: 'pointer' }}>
            Sayfa metinlerinin yapılandırdığım LLM sağlayıcısına iletilmesini açıkça onaylıyorum.
          </label>
        </div>
      </div>

      {/* Security Limitations Disclosure */}
      <div className="section-card">
        <h2 className="section-title">Güvenlik ve Sınırlamalar Bilgilendirmesi</h2>
        <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
          Tarayıcı eklenti depolaması (Extension Storage), işletim sistemi düzeyinde bir şifreleme kasası (Hardware Security Module) değildir. Cihazınızda kötü amaçlı yazılım bulunması halinde yerel depolamaya erişilebilir. Bu nedenle:
        </p>
        <ul style={{ fontSize: '12px', color: '#94a3b8', paddingLeft: '18px', marginTop: '6px', lineHeight: '1.5' }}>
          <li>Kullandığınız API anahtarına harcama limiti ve kota tanımlayın.</li>
          <li>Gerektiğinde "Tüm Verileri Sıfırla" veya "Sil" butonunu kullanarak anahtarı kaldırın.</li>
        </ul>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn-danger"
          id="clear-all-data-btn"
          onClick={handleClearAll}
        >
          <Trash2 size={16} /> Tüm Eklenti Verilerini Sıfırla
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-secondary"
            id="test-connection-btn"
            disabled={testingConnection}
            onClick={handleTestConnection}
          >
            {testingConnection ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
          </button>
          <button
            className="btn-secondary"
            id="save-settings-btn"
            style={{ background: '#2563eb', color: '#ffffff', borderColor: '#3b82f6' }}
            onClick={handleSave}
          >
            <Save size={16} /> Değişiklikleri Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};
