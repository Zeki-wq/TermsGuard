import { ExtractedDocument } from '../types';
import { chunkText } from './chunker';

export interface ExtractionOptions {
  maxTotalChars?: number;
}

/**
 * Checks if a DOM element is visible to an ordinary user.
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;

  const doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const view = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
  const style = view ? view.getComputedStyle(el) : ((el as any).style || {});

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    el.hidden ||
    el.getAttribute('aria-hidden') === 'true' ||
    el.getAttribute('style')?.includes('display: none') ||
    el.getAttribute('style')?.includes('visibility: hidden')
  ) {
    return false;
  }

  return true;
}

/**
 * Detects probable legal document type from title, headings, and URL.
 */
export function detectDocumentType(title: string, url: string, sampleText: string): string {
  const combined = `${title} ${url} ${sampleText.substring(0, 1000)}`.toLowerCase();

  if (combined.includes('privacy') || combined.includes('gizlilik') || combined.includes('kvkk') || combined.includes('gdpr')) {
    return 'Gizlilik Politikası (Privacy Policy)';
  }
  if (combined.includes('subscription') || combined.includes('abonelik') || combined.includes('recurring') || combined.includes('billing')) {
    return 'Abonelik ve Ödeme Koşulları (Subscription Agreement)';
  }
  if (combined.includes('cancellation') || combined.includes('refund') || combined.includes('iptal') || combined.includes('iade')) {
    return 'İptal ve İade Politikası (Cancellation/Refund Policy)';
  }
  if (combined.includes('cookie') || combined.includes('çerez')) {
    return 'Çerez Politikası (Cookie Policy)';
  }
  if (combined.includes('terms') || combined.includes('tos') || combined.includes('kullanım') || combined.includes('şart')) {
    return 'Kullanım Koşulları (Terms of Service)';
  }

  return 'Yasal Sözleşme / Metin (Legal Document)';
}

/**
 * Cleanly extracts visible text from the DOM.
 */
export function extractVisibleDOMText(doc: Document = document): {
  rawText: string;
  title: string;
  url: string;
  domain: string;
  documentType: string;
} {
  const title = doc.title || 'Adsız Belge';
  const url = doc.location?.href || '';
  const domain = doc.location?.hostname || '';

  // Tags to completely ignore (security & noise prevention)
  const ignoredTags = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'NAV',
    'FOOTER',
    'HEADER',
    'SVG',
    'CANVAS',
    'AUDIO',
    'VIDEO',
    'IFRAME',
    'OBJECT',
    'EMBED',
  ]);

  // Try to find the main content container first
  const mainContainers = [
    doc.querySelector('main'),
    doc.querySelector('article'),
    doc.querySelector('[role="main"]'),
    doc.querySelector('.terms-content'),
    doc.querySelector('.legal-content'),
    doc.querySelector('#legal-content'),
    doc.body,
  ].filter(Boolean) as HTMLElement[];

  const rootElement = mainContainers[0] || doc.body;
  if (!rootElement) {
    return {
      rawText: '',
      title,
      url,
      domain,
      documentType: 'Bilinmeyen',
    };
  }

  const collectedLines: string[] = [];

  function traverse(node: Node) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        collectedLines.push(text);
      }
      return;
    }

    if (node.nodeType === 1 /* ELEMENT_NODE */) {
      const el = node as HTMLElement;
      if (ignoredTags.has(el.tagName)) return;
      if (!isElementVisible(el)) return; // Strictly ignore hidden DOM text (prevents hidden prompt injection!)

      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i]);
      }

      // Add logical line breaks after block elements
      if (
        ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'SECTION', 'ARTICLE', 'BR', 'TR'].includes(
          el.tagName
        )
      ) {
        collectedLines.push('\n');
      }
    }
  }

  traverse(rootElement);

  // Normalize formatting into readable paragraphs
  const rawText = collectedLines
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  const documentType = detectDocumentType(title, url, rawText);

  return {
    rawText,
    title,
    url,
    domain,
    documentType,
  };
}

/**
 * Main extraction pipeline turning page DOM into an indexed ExtractedDocument.
 */
export function extractPageDocument(
  doc: Document = document,
  options: ExtractionOptions = {}
): ExtractedDocument {
  const { rawText, title, url, domain, documentType } = extractVisibleDOMText(doc);
  const chunkResult = chunkText(rawText, { maxTotalChars: options.maxTotalChars });

  let extractionNotice: string | undefined;
  if (rawText.length < 200) {
    extractionNotice = 'Sayfada yeterli yasal metin tespit edilemedi veya içerik dinamik olarak engellendi.';
  } else if (chunkResult.isTruncated) {
    extractionNotice = `Belge güvenlik sınırını aştığı için ilk ${chunkResult.chunks.length} bölüm analiz edilecek şekilde sınırlandırıldı.`;
  }

  return {
    title,
    url,
    domain,
    documentType,
    rawText,
    characterCount: rawText.length,
    chunks: chunkResult.chunks,
    isTruncated: chunkResult.isTruncated,
    extractionNotice,
    timestamp: new Date().toISOString(),
  };
}
