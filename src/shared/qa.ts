import { ExtractedDocument, QAAnswer } from './types';
import { LLMProvider } from './providers/types';

export async function askContractQuestion(
  question: string,
  document: ExtractedDocument,
  provider?: LLMProvider
): Promise<QAAnswer> {
  const cleanQ = question.trim().toLowerCase();

  // If live LLM is configured and not mock, query with strict grounding prompt
  if (provider && provider.name.includes('OpenAI')) {
    try {
      const prompt = `You are TermsGuard Q&A assistant.
DOCUMENT CONTEXT:
${document.rawText.substring(0, 15000)}

USER QUESTION: "${question}"

INSTRUCTIONS:
1. Answer the question in clear Turkish strictly based on the text above.
2. Provide the exact quotation from the text in "relevantQuote".
3. If the answer is not in the text, say: "Bu konuda sözleşmede doğrudan bir madde bulunmamaktadır."
Return JSON: { "answerTr": string, "relevantQuote": string, "foundInSource": boolean }`;

      const response = await provider.analyze(prompt);
      if (response && response.summaryTr) {
        return {
          question,
          answerTr: response.summaryTr,
          foundInSource: true,
        };
      }
    } catch {
      // Fallback to deterministic retrieval below
    }
  }

  // Deterministic Grounded Retrieval Fallback
  const text = document.rawText;
  const lowerText = text.toLowerCase();

  const queryKeywords: Record<string, string[]> = {
    iade: ['refund', 'iade', 'reimbursement', 'credit', 'para iadesi'],
    iptal: ['cancel', 'cancellation', 'iptal', 'terminate', 'fesih'],
    para: ['payment', 'billing', 'fee', 'ödeme', 'ücret', 'subscription'],
    hesap: ['account', 'hesap', 'suspend', 'askıya', 'kapatma'],
    veri: ['data', 'privacy', 'gizlilik', 'kişisel veri', 'share', 'üçüncü taraf'],
    tahkim: ['arbitration', 'tahkim', 'court', 'mahkeme', 'dispute', 'uyuşmazlık'],
  };

  let matchedKeywords: string[] = [];
  for (const [topic, kws] of Object.entries(queryKeywords)) {
    if (cleanQ.includes(topic) || kws.some((k) => cleanQ.includes(k))) {
      matchedKeywords = kws;
      break;
    }
  }

  if (matchedKeywords.length === 0) {
    matchedKeywords = cleanQ.split(/\s+/).filter((w) => w.length > 3);
  }

  let bestMatchSentence: string | null = null;
  for (const kw of matchedKeywords) {
    const idx = lowerText.indexOf(kw);
    if (idx !== -1) {
      const sentenceStart = Math.max(0, text.lastIndexOf('.', idx) + 1);
      let sentenceEnd = text.indexOf('.', idx + kw.length);
      if (sentenceEnd === -1) sentenceEnd = Math.min(text.length, idx + 150);
      else sentenceEnd += 1;

      const sentence = text.substring(sentenceStart, sentenceEnd).trim();
      if (sentence.length > 25) {
        bestMatchSentence = sentence;
        break;
      }
    }
  }

  if (bestMatchSentence) {
    return {
      question,
      answerTr: `Sözleşme metninde sorunuzla doğrudan ilgili şu madde tespit edildi:`,
      relevantQuote: bestMatchSentence,
      foundInSource: true,
    };
  }

  return {
    question,
    answerTr: `İncelenen sözleşme metninde "${question}" sorusuna dair doğrudan veya açık bir maddeye rastlanmadı. Şirketin ek sözleşmeleri veya sıkça sorulan sorular (SSS) sayfasını incelemeniz önerilir.`,
    foundInSource: false,
  };
}
