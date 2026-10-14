import { extractPageDocument } from '../shared/extraction/extractor';
import { CATEGORY_LABELS_TR, LEGAL_COMPLIANCE_TR, RiskCategory, RiskSeverity, SEVERITY_LABELS_TR } from '../shared/types';

// Injects styles for in-page highlighting and floating alert tooltip
function ensureHighlightStyles() {
  if (document.getElementById('termsguard-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'termsguard-highlight-style';
  style.textContent = `
    .termsguard-highlight-active {
      background: rgba(245, 158, 11, 0.35) !important;
      outline: 3px solid #f59e0b !important;
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.6) !important;
      border-radius: 4px !important;
      position: relative !important;
      display: inline !important;
      transition: all 0.4s ease-in-out !important;
      animation: termsguard-pulse 2s infinite alternate !important;
    }
    .termsguard-highlight-critical {
      background: rgba(239, 68, 68, 0.35) !important;
      outline: 3px solid #ef4444 !important;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.6) !important;
    }
    @keyframes termsguard-pulse {
      0% { outline-color: #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.4); }
      100% { outline-color: #ef4444; box-shadow: 0 0 25px rgba(239, 68, 68, 0.8); }
    }
    .termsguard-floating-badge {
      position: absolute;
      top: -34px;
      left: 0;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      font-family: system-ui, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
      white-space: nowrap;
    }
    .termsguard-badge-close {
      cursor: pointer;
      color: #94a3b8;
      margin-left: 6px;
      font-weight: bold;
    }
    .termsguard-badge-close:hover {
      color: #f8fafc;
    }
  `;
  document.head.appendChild(style);
}

function clearPreviousHighlights() {
  const existing = document.querySelectorAll('.termsguard-highlight-active, .termsguard-floating-badge');
  existing.forEach((el) => {
    if (el.classList.contains('termsguard-floating-badge')) {
      el.remove();
    } else {
      el.classList.remove('termsguard-highlight-active', 'termsguard-highlight-critical');
    }
  });
}

function highlightInDOM(quote: string, category: RiskCategory, severity: RiskSeverity): boolean {
  if (!quote || quote.length < 5) return false;
  ensureHighlightStyles();
  clearPreviousHighlights();

  const cleanQuote = quote.trim();
  const searchAnchor = cleanQuote.substring(0, Math.min(40, cleanQuote.length)).toLowerCase();

  // TreeWalker to scan all visible text nodes
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  let matchedNode: Node | null = null;

  while (currentNode) {
    const text = currentNode.textContent?.toLowerCase() || '';
    if (text.includes(searchAnchor)) {
      matchedNode = currentNode;
      break;
    }
    currentNode = walker.nextNode();
  }

  if (!matchedNode || !matchedNode.parentElement) {
    return false;
  }

  const parent = matchedNode.parentElement;
  parent.classList.add('termsguard-highlight-active');
  if (severity === 'critical' || severity === 'high') {
    parent.classList.add('termsguard-highlight-critical');
  }

  // Inject floating notification badge
  const compliance = LEGAL_COMPLIANCE_TR[category];
  const badge = document.createElement('div');
  badge.className = 'termsguard-floating-badge';
  badge.innerHTML = `
    <span>🛡️ TermsGuard: <strong>[${SEVERITY_LABELS_TR[severity] || severity}] ${CATEGORY_LABELS_TR[category] || category}</strong></span>
    ${compliance ? `<span style="color: #60a5fa; margin-left: 4px;">(${compliance.law} ${compliance.clause})</span>` : ''}
    <span class="termsguard-badge-close" title="Kapat">✕</span>
  `;

  badge.querySelector('.termsguard-badge-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPreviousHighlights();
  });

  // Position badge
  parent.style.position = 'relative';
  parent.appendChild(badge);

  // Smooth scroll with margin
  parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

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
    return true;
  }

  if (message && message.type === 'HIGHLIGHT_CLAUSE') {
    try {
      const success = highlightInDOM(message.quote, message.category, message.severity);
      sendResponse({ success });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ success: false, error: errorMsg });
    }
    return true;
  }
});
