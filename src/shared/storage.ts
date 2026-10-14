import { LLMSettings, RiskReport } from './types';

const DEFAULT_SETTINGS: LLMSettings = {
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
  dataConsentGranted: false,
};

export function maskApiKey(key: string): string {
  if (!key || key.trim().length === 0) return 'Ayarlanmadı';
  const clean = key.trim();
  if (clean.length <= 8) return '********';
  return `${clean.substring(0, 4)}...${clean.substring(clean.length - 4)}`;
}

export async function getSettings(): Promise<LLMSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['termsguard_settings'], (result) => {
        resolve({ ...DEFAULT_SETTINGS, ...(result.termsguard_settings || {}) });
      });
    });
  }

  // Fallback to localStorage for testing/Cypress
  try {
    const raw = localStorage.getItem('termsguard_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Partial<LLMSettings>): Promise<LLMSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ termsguard_settings: updated }, () => {
        resolve(updated);
      });
    });
  }

  try {
    localStorage.setItem('termsguard_settings', JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export async function getLatestReport(): Promise<RiskReport | null> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['termsguard_latest_report'], (result) => {
        resolve(result.termsguard_latest_report || null);
      });
    });
  }

  try {
    const raw = localStorage.getItem('termsguard_latest_report');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function saveLatestReport(report: RiskReport): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ termsguard_latest_report: report }, () => resolve());
    });
  }

  try {
    localStorage.setItem('termsguard_latest_report', JSON.stringify(report));
  } catch {}
}

export async function clearAllExtensionData(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  }

  try {
    localStorage.removeItem('termsguard_settings');
    localStorage.removeItem('termsguard_latest_report');
    localStorage.removeItem('termsguard_extracted_doc');
  } catch {}
}
