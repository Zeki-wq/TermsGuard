import { RawLLMResponse } from '../types';
import { LLMProvider, ProviderRequestOptions } from './types';
import { buildSystemPrompt, formatPromptWithUntrustedDocument } from './injection-defense';
import { parseAndValidateLLMResponse } from '../schema/validator';

export class OpenAICompatibleAdapter implements LLMProvider {
  readonly name = 'OpenAI-Compatible';
  private endpoint: string;
  private model: string;
  private apiKey: string;

  constructor(endpoint: string, model: string, apiKey: string) {
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.model = model;
    this.apiKey = apiKey;
  }

  async analyze(documentText: string, options?: ProviderRequestOptions): Promise<RawLLMResponse> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error(
        'API Anahtarı eksik. Lütfen Eklenti Ayarları sayfasından geçerli bir API anahtarı yapılandırın.'
      );
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = formatPromptWithUntrustedDocument(documentText, {
      title: options?.title,
      domain: options?.domain,
    });

    const url = `${this.endpoint}/chat/completions`;
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 45000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('API sağlayıcısı kimlik doğrulama hatası verdi (401/403). Lütfen API anahtarınızı kontrol edin.');
        }
        if (response.status === 429) {
          throw new Error('API sağlayıcısı istek sınırını aştı (429 Rate Limit). Lütfen biraz bekleyin veya kotanızı kontrol edin.');
        }
        const errorText = await response.text().catch(() => '');
        throw new Error(`API sağlayıcısı hata döndürdü (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const responseData = await response.json();
      const messageContent = responseData.choices?.[0]?.message?.content;

      if (!messageContent) {
        throw new Error('API sağlayıcısından boş içerik yanıtı alındı.');
      }

      const validation = parseAndValidateLLMResponse(messageContent);
      if (!validation.valid || !validation.data) {
        throw new Error(
          `Model çıktısı şema kurallarını karşılamadı:\n${(validation.errors || []).join('\n')}`
        );
      }

      return validation.data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(`İstek zaman aşımına uğradı (${Math.round(timeoutMs / 1000)} saniye). Sayfa metni çok uzun veya ağ yavaş olabilir.`);
        }
        throw err;
      }
      throw new Error(`Bilinmeyen ağ veya sağlayıcı hatası: ${String(err)}`);
    }
  }
}
