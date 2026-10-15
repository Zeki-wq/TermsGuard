export interface CompiledValidateFunction<T = unknown> {
  (data: unknown): boolean;
  errors?: Array<{
    instancePath?: string;
    schemaPath?: string;
    keyword?: string;
    params?: Record<string, unknown>;
    message?: string;
  }> | null;
}

export const validateRiskReport: CompiledValidateFunction;
export const validateLLMResponse: CompiledValidateFunction;
