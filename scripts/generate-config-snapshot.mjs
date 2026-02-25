import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const configRoot = path.join(root, 'config');
const workerSnapshot = path.join(root, 'packages/worker/src/generated/config.snapshot.json');

const ajv = new Ajv2020({ allErrors: true, strict: false });

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function loadYaml(p) {
  return YAML.parse(fs.readFileSync(p, 'utf8'));
}
function validate(schemaPath, value, label) {
  const validateFn = ajv.compile(loadJson(schemaPath));
  if (!validateFn(value)) {
    const msg = (validateFn.errors || []).map((e) => `${e.instancePath || '/'} ${e.message || 'invalid'}`).join('; ');
    throw new Error(`${label} failed validation: ${msg}`);
  }
  return value;
}

const sourcesDir = path.join(configRoot, 'sources');
const schemasDir = path.join(configRoot, 'schemas');
const sources = fs.readdirSync(sourcesDir).filter((f) => f.endsWith('.yaml')).sort().map((f) =>
  validate(path.join(schemasDir, 'source.schema.json'), loadYaml(path.join(sourcesDir, f)), `config/sources/${f}`),
);
const taxonomy = validate(path.join(schemasDir, 'taxonomy.schema.json'), loadYaml(path.join(configRoot, 'taxonomy.yaml')), 'config/taxonomy.yaml');
const normalization = validate(path.join(schemasDir, 'normalization.schema.json'), loadYaml(path.join(configRoot, 'normalization.yaml')), 'config/normalization.yaml');
const ui = validate(path.join(schemasDir, 'ui.schema.json'), loadYaml(path.join(configRoot, 'ui.yaml')), 'config/ui.yaml');

fs.mkdirSync(path.dirname(workerSnapshot), { recursive: true });
fs.writeFileSync(workerSnapshot, JSON.stringify({ sources, taxonomy, normalization, ui }, null, 2));
console.log(`Wrote ${workerSnapshot}`);
