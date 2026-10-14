import { runAnalysisPipeline } from '../shared/pipeline';
import { getSettings, saveLatestReport, clearAllExtensionData } from '../shared/storage';
import { OpenAICompatibleAdapter } from '../shared/providers/openai-adapter';
import { DeterministicMockAdapter } from '../shared/providers/mock-adapter';
import { ExtractedDocument } from '../shared/types';
import { extractPageDocument } from '../shared/extraction/extractor';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[TermsGuard] Service Worker yüklendi ve hazır.');
});

// Helper to query the active tab safely
async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

// Helper to extract content from active tab
async function extractFromTab(tabId: number): Promise<ExtractedDocument> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_CONTENT' });
    if (response && response.success && response.data) {
      return response.data;
    }
  } catch {
    // If content script was not injected yet, inject dynamically
  }

  // Fallback to programmatic injection via chrome.scripting
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Inline lightweight visible DOM extractor
      const title = document.title || 'Adsız Belge';
      const url = window.location.href;
      const domain = window.location.hostname;
      const mainEl = document.querySelector('main') || document.querySelector('article') || document.body;
      const rawText = (mainEl ? mainEl.innerText : document.body.innerText) || '';
      return { title, url, domain, rawText };
    },
  });

  if (!results || !results[0] || !results[0].result) {
    throw new Error('Aktif sekmeden metin çıkarılamadı.');
  }

  const { title, url, domain, rawText } = results[0].result;
  const dummyDoc: Document = {
    title,
    location: { href: url, hostname: domain } as unknown as Location,
    body: { innerText: rawText } as unknown as HTMLElement,
    querySelector: () => null,
  } as unknown as Document;

  return extractPageDocument(dummyDoc);
}

// Message Dispatcher
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return;

  (async () => {
    try {
      if (message.type === 'START_ANALYSIS') {
        const tab = await getActiveTab();
        if (!tab || !tab.id) {
          throw new Error('Aktif bir sekme bulunamadı.');
        }

        const settings = await getSettings();

        // Check user consent for sending text to LLM
        if (!settings.dataConsentGranted) {
          sendResponse({
            success: false,
            needsConsent: true,
            error: 'Belge içeriğinin seçtiğiniz LLM sağlayıcısına iletilebilmesi için onayınız gereklidir.',
          });
          return;
        }

        // Extract text
        const document = await extractFromTab(tab.id);

        // Select provider
        let provider;
        if (settings.provider === 'mock') {
          provider = new DeterministicMockAdapter();
        } else {
          if (!settings.apiKey) {
            throw new Error('LLM API Anahtarı tanımlanmamış. Lütfen Ayarlar sekmesinden API anahtarınızı girin.');
          }
          provider = new OpenAICompatibleAdapter(
            settings.endpoint,
            settings.model,
            settings.apiKey
          );
        }

        // Execute analysis pipeline
        const report = await runAnalysisPipeline({ provider, document });

        // Save report
        await saveLatestReport(report);

        sendResponse({ success: true, report, document });
        return;
      }

      if (message.type === 'ANALYZE_EXPLICIT_DOC') {
        const settings = await getSettings();
        let provider;
        if (settings.provider === 'mock') {
          provider = new DeterministicMockAdapter(message.mockOptions || {});
        } else {
          provider = new OpenAICompatibleAdapter(
            settings.endpoint,
            settings.model,
            settings.apiKey
          );
        }

        const report = await runAnalysisPipeline({
          provider,
          document: message.document,
        });

        await saveLatestReport(report);
        sendResponse({ success: true, report });
        return;
      }

      if (message.type === 'CLEAR_DATA') {
        await clearAllExtensionData();
        sendResponse({ success: true });
        return;
      }

      sendResponse({ success: false, error: 'Bilinmeyen işlem türü.' });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ success: false, error: errorMsg });
    }
  })();

  return true; // Asynchronous sendResponse
});
