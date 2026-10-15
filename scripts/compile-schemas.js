import fs from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';

const ajv = new Ajv({
  code: { source: true, esm: true },
  allErrors: true,
  strict: false,
  coerceTypes: true,
});
addFormats(ajv);

const riskReportSchema = JSON.parse(fs.readFileSync('schemas/risk-report.schema.json', 'utf-8'));
const llmResponseSchema = JSON.parse(fs.readFileSync('schemas/llm-response.schema.json', 'utf-8'));

ajv.addSchema(riskReportSchema, 'riskReport');
ajv.addSchema(llmResponseSchema, 'llmResponse');

let code = standaloneCode(ajv, {
  validateRiskReport: 'riskReport',
  validateLLMResponse: 'llmResponse',
});

// Replace CommonJS require for ucs2length with clean inlined helper
const inlinedUcs2 = `function ucs2length(str) {
  const len = str.length;
  let length = 0;
  let pos = 0;
  while (pos < len) {
    length++;
    const value = str.charCodeAt(pos++);
    if (value >= 0xd800 && value <= 0xdbff && pos < len) {
      const extra = str.charCodeAt(pos);
      if ((extra & 0xfc00) === 0xdc00) pos++;
    }
  }
  return length;
}`;

code = code.replace(
  /const\s+(\w+)\s*=\s*require\("ajv\/dist\/runtime\/ucs2length"\)\.default;/,
  `${inlinedUcs2}\nconst $1 = ucs2length;`
);

fs.mkdirSync('src/shared/schema', { recursive: true });
fs.writeFileSync('src/shared/schema/compiled-validators.js', code, 'utf-8');
console.log('Successfully generated pure CSP-compliant Ajv validator: src/shared/schema/compiled-validators.js');
