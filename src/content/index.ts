import { extractPageDocument } from '../shared/extraction/extractor';

// Listen for messages from background script or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'EXTRACT_PAGE_CONTENT') {
    try {
      const extracted = extractPageDocument(document);
      sendResponse({ success: true, data: extracted });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ success: false, error: `İçerik çıkarılırken hata oluştu: ${errorMsg}` });
    }
    return true; // Keep message channel open for async response
  }
});
