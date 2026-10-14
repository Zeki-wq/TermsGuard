import {
  LLMCandidateFinding,
  RiskFinding,
  RejectedFinding,
  SourceChunk,
} from '../types';

export interface VerificationResult {
  verifiedFindings: RiskFinding[];
  rejectedFindings: RejectedFinding[];
  totalCandidates: number;
}

/**
 * Normalizes text for matching without mutating the original text:
 * - NFC Unicode normalization
 * - Collapsing multiple whitespace/newlines to single space
 * - Lowercases for case-insensitive candidate search, but keeps exact offset mapping
 */
export function normalizeForSearch(str: string): string {
  return str
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds exact or whitespace-normalized substring in source text.
 * Returns global start and end character offsets in the original rawText.
 */
export function findQuotationOffsets(
  quote: string,
  rawText: string
): { start: number; end: number } | null {
  if (!quote || quote.trim().length === 0 || !rawText) {
    return null;
  }

  // 1. Direct exact match (preserves exact casing and whitespace)
  const directIndex = rawText.indexOf(quote);
  if (directIndex !== -1) {
    return {
      start: directIndex,
      end: directIndex + quote.length,
    };
  }

  // 2. Direct trimmed match
  const trimmed = quote.trim();
  const trimmedIndex = rawText.indexOf(trimmed);
  if (trimmedIndex !== -1) {
    return {
      start: trimmedIndex,
      end: trimmedIndex + trimmed.length,
    };
  }

  // 3. Normalized whitespace match
  // When LLM wraps newlines or collapses spaces, find the match in whitespace-relaxed form
  const normalizedRaw = normalizeForSearch(rawText);
  const normalizedQuote = normalizeForSearch(quote);

  if (normalizedQuote.length < 10) {
    // Very short quotes with whitespace mismatch are too ambiguous
    return null;
  }

  const normIndex = normalizedRaw.indexOf(normalizedQuote);
  if (normIndex === -1) {
    return null;
  }

  // Approximate offset in rawText using token mapping
  // We locate the first 20 chars of the quote in rawText
  const anchorLength = Math.min(25, trimmed.length);
  const anchor = trimmed.substring(0, anchorLength);
  const anchorIndex = rawText.indexOf(anchor);

  if (anchorIndex !== -1) {
    // Find the end anchor
    const endAnchor = trimmed.substring(trimmed.length - Math.min(20, trimmed.length));
    const rawSliceFromAnchor = rawText.substring(anchorIndex);
    const endAnchorIndex = rawSliceFromAnchor.indexOf(endAnchor);

    if (endAnchorIndex !== -1) {
      const globalEnd = anchorIndex + endAnchorIndex + endAnchor.length;
      return {
        start: anchorIndex,
        end: globalEnd,
      };
    }

    return {
      start: anchorIndex,
      end: Math.min(rawText.length, anchorIndex + quote.length),
    };
  }

  return null;
}

/**
 * Determines which chunk contains the offset range.
 */
export function findMatchingChunkId(
  chunks: SourceChunk[],
  start: number,
  end: number,
  suggestedChunkId?: string
): string {
  if (chunks.length === 0) return 'chunk_0';

  if (suggestedChunkId) {
    const chunk = chunks.find((c) => c.chunkId === suggestedChunkId);
    if (chunk && start >= chunk.startOffset && end <= chunk.endOffset + 200) {
      return chunk.chunkId;
    }
  }

  // Find the chunk with the largest overlap
  for (const chunk of chunks) {
    if (start >= chunk.startOffset && start <= chunk.endOffset) {
      return chunk.chunkId;
    }
  }

  return chunks[0].chunkId;
}

/**
 * Verifies candidate findings against raw document text and chunks.
 * Strictly rejects hallucinations, fabrications, paraphrasing, and ambiguous quotes.
 */
export function verifyFindings(
  candidates: LLMCandidateFinding[],
  rawText: string,
  chunks: SourceChunk[]
): VerificationResult {
  const verifiedFindings: RiskFinding[] = [];
  const rejectedFindings: RejectedFinding[] = [];

  // Deduplication tracker: Set of `${category}:${normalizedQuote}`
  const seenQuotes = new Set<string>();

  for (const candidate of candidates) {
    const quote = candidate.originalQuote;

    // Check 1: Existence of quote
    if (!quote || typeof quote !== 'string' || quote.trim().length === 0) {
      rejectedFindings.push({
        originalQuote: quote || '(boş alıntı)',
        reason: 'Eksik veya boş alıntı sağlandı (MISSING_QUOTE).',
        claimedCategory: candidate.category,
        claimedSeverity: candidate.severity,
      });
      continue;
    }

    // Check 2: Minimum quote length (prevent single words like "and", "or", "party")
    const cleanQuote = quote.trim();
    if (cleanQuote.length < 15) {
      rejectedFindings.push({
        originalQuote: cleanQuote,
        reason: 'Alıntı çok kısa ve belirsiz (<15 karakter), kanıt olarak doğrulanamaz (AMBIGUOUS_SHORT_QUOTE).',
        claimedCategory: candidate.category,
        claimedSeverity: candidate.severity,
      });
      continue;
    }

    // Check 3: Deterministic matching in source text
    const offsets = findQuotationOffsets(cleanQuote, rawText);
    if (!offsets) {
      rejectedFindings.push({
        originalQuote: cleanQuote,
        reason: 'Alıntı kaynak metinde birebir bulunamadı; uydurma veya parafraz edilmiş olabilir (FABRICATED_OR_PARAPHRASED_QUOTE).',
        claimedCategory: candidate.category,
        claimedSeverity: candidate.severity,
      });
      continue;
    }

    // Check 4: Deterministic deduplication
    const normKey = `${candidate.category}:${normalizeForSearch(cleanQuote)}`;
    if (seenQuotes.has(normKey)) {
      // Discard duplicate without adding to verified score
      rejectedFindings.push({
        originalQuote: cleanQuote,
        reason: 'Mükerrer bulgu: Bu madde veya benzer ifade aynı kategori altında zaten değerlendirildi (DUPLICATE_FINDING).',
        claimedCategory: candidate.category,
        claimedSeverity: candidate.severity,
      });
      continue;
    }
    seenQuotes.add(normKey);

    // Check 5: Resolve chunk ID
    const resolvedChunkId = findMatchingChunkId(
      chunks,
      offsets.start,
      offsets.end,
      candidate.sourceChunkId
    );

    verifiedFindings.push({
      id: candidate.id || `finding_${verifiedFindings.length + 1}`,
      category: candidate.category,
      severity: candidate.severity,
      originalQuote: cleanQuote,
      explanationTr: candidate.explanationTr,
      whyItMattersTr: candidate.whyItMattersTr,
      sourceChunkId: resolvedChunkId,
      sourceStartOffset: offsets.start,
      sourceEndOffset: offsets.end,
      confidence: typeof candidate.confidence === 'number' ? Math.max(0, Math.min(1, candidate.confidence)) : 0.9,
      verificationStatus: 'verified',
    });
  }

  return {
    verifiedFindings,
    rejectedFindings,
    totalCandidates: candidates.length,
  };
}
