import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/shared/extraction/chunker';

describe('Deterministic Chunker', () => {
  it('returns empty chunks for empty string', () => {
    const result = chunkText('');
    expect(result.chunks).toHaveLength(0);
    expect(result.totalChars).toBe(0);
    expect(result.isTruncated).toBe(false);
  });

  it('preserves small text in a single chunk with exact offsets', () => {
    const text = 'This is a small legal terms document paragraph.';
    const result = chunkText(text, { maxChunkSize: 500 });
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].chunkId).toBe('chunk_0');
    expect(result.chunks[0].startOffset).toBe(0);
    expect(result.chunks[0].endOffset).toBe(text.length);
    expect(result.chunks[0].text).toBe(text);
  });

  it('splits long text into overlapping chunks while preserving sequential offsets', () => {
    const sentence = 'Section clause paragraph terms of service policy information text. ';
    const text = sentence.repeat(50); // ~3400 chars
    const result = chunkText(text, { maxChunkSize: 1000, overlapSize: 150 });

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks[0].startOffset).toBe(0);

    for (let i = 1; i < result.chunks.length; i++) {
      const prev = result.chunks[i - 1];
      const curr = result.chunks[i];
      // Check overlap
      expect(curr.startOffset).toBeLessThan(prev.endOffset);
      expect(curr.startOffset).toBeGreaterThanOrEqual(prev.startOffset);
      expect(text.substring(curr.startOffset, curr.endOffset)).toBe(curr.text);
    }
  });

  it('marks truncation when total characters exceed maxTotalChars limit', () => {
    const text = 'A'.repeat(5000);
    const result = chunkText(text, { maxChunkSize: 1000, maxTotalChars: 2500 });
    expect(result.isTruncated).toBe(true);
    expect(result.totalChars).toBe(5000);
    expect(result.truncatedAt).toBe(2500);
  });
});
