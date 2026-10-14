import { RawLLMResponse } from '../types';

export interface ProviderRequestOptions {
  title?: string;
  domain?: string;
  timeoutMs?: number;
}

export interface LLMProvider {
  readonly name: string;
  analyze(documentText: string, options?: ProviderRequestOptions): Promise<RawLLMResponse>;
}
