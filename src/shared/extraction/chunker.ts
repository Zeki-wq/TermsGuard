import { SourceChunk } from '../types';

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  maxTotalChars?: number;
}

export interface ChunkingResult {
  chunks: SourceChunk[];
  totalChars: number;
  isTruncated: boolean;
  truncatedAt?: number;
}

const DEFAULT_MAX_CHUNK_SIZE = 2500;
const DEFAULT_OVERLAP_SIZE = 250;
const DEFAULT_MAX_TOTAL_CHARS = 120000; // ~30,000 words safety ceiling

/**
 * Splits text into deterministic overlapping chunks while preserving stable character offsets.
 */
export function chunkText(
  fullText: string,
  options: ChunkingOptions = {}
): ChunkingResult {
  const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const overlapSize = options.overlapSize ?? DEFAULT_OVERLAP_SIZE;
  const maxTotalChars = options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;

  const totalLength = fullText.length;
  let textToProcess = fullText;
  let isTruncated = false;
  let truncatedAt: number | undefined;

  if (totalLength > maxTotalChars) {
    textToProcess = fullText.substring(0, maxTotalChars);
    isTruncated = true;
    truncatedAt = maxTotalChars;
  }

  const chunks: SourceChunk[] = [];
  let currentStart = 0;
  let chunkIndex = 0;

  if (textToProcess.trim().length === 0) {
    return {
      chunks: [],
      totalChars: 0,
      isTruncated: false,
    };
  }

  while (currentStart < textToProcess.length) {
    let currentEnd = Math.min(currentStart + maxChunkSize, textToProcess.length);

    // If not at the very end, try to snap to a paragraph or sentence boundary
    if (currentEnd < textToProcess.length) {
      const windowStart = Math.max(currentStart + Math.floor(maxChunkSize * 0.75), currentStart);
      const windowSlice = textToProcess.substring(windowStart, currentEnd);

      const paragraphBreak = windowSlice.lastIndexOf('\n\n');
      const newlineBreak = windowSlice.lastIndexOf('\n');
      const sentenceBreak = Math.max(
        windowSlice.lastIndexOf('. '),
        windowSlice.lastIndexOf('? '),
        windowSlice.lastIndexOf('! ')
      );

      if (paragraphBreak !== -1) {
        currentEnd = windowStart + paragraphBreak + 2;
      } else if (sentenceBreak !== -1) {
        currentEnd = windowStart + sentenceBreak + 2;
      } else if (newlineBreak !== -1) {
        currentEnd = windowStart + newlineBreak + 1;
      }
    }

    const chunkContent = textToProcess.substring(currentStart, currentEnd);
    chunks.push({
      chunkId: `chunk_${chunkIndex}`,
      text: chunkContent,
      startOffset: currentStart,
      endOffset: currentEnd,
    });

    chunkIndex++;
    if (currentEnd >= textToProcess.length) {
      break;
    }

    // Advance start with overlap
    currentStart = Math.max(currentStart + 1, currentEnd - overlapSize);
  }

  return {
    chunks,
    totalChars: totalLength,
    isTruncated,
    truncatedAt,
  };
}
