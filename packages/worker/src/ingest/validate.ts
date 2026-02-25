import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import YAML from 'yaml';
import type { ConfigBundle, NormalizationConfig, SourceConfig, TaxonomyConfig, UiConfig } from '../types';

const ajv = new Ajv2020({ allErrors: true, strict: false });

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'Unknown schema validation error';
  return errors.map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`).join('; ');
}

function validateWithSchema<T>(schemaPath: string, value: unknown, label: string): T {
  const schema = readJson(schemaPath) as object;
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new Error(`${label} failed validation: ${formatAjvErrors(validate.errors)}`);
  }
  return value as T;
}

function loadYaml(filePath: string): unknown {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadAndValidateConfigBundle(configRoot: string): ConfigBundle {
  const schemasRoot = path.join(configRoot, 'schemas');
  const sourcesDir = path.join(configRoot, 'sources');
  const sourceFiles = fs.readdirSync(sourcesDir).filter((f) => f.endsWith('.yaml')).sort();
  const sources: SourceConfig[] = sourceFiles.map((file) =>
    validateWithSchema<SourceConfig>(
      path.join(schemasRoot, 'source.schema.json'),
      loadYaml(path.join(sourcesDir, file)),
      `config/sources/${file}`,
    ),
  );
  const taxonomy = validateWithSchema<TaxonomyConfig>(
    path.join(schemasRoot, 'taxonomy.schema.json'),
    loadYaml(path.join(configRoot, 'taxonomy.yaml')),
    'config/taxonomy.yaml',
  );
  const normalization = validateWithSchema<NormalizationConfig>(
    path.join(schemasRoot, 'normalization.schema.json'),
    loadYaml(path.join(configRoot, 'normalization.yaml')),
    'config/normalization.yaml',
  );
  const ui = validateWithSchema<UiConfig>(
    path.join(schemasRoot, 'ui.schema.json'),
    loadYaml(path.join(configRoot, 'ui.yaml')),
    'config/ui.yaml',
  );

  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.source_id)) {
      throw new Error(`Duplicate source_id: ${source.source_id}`);
    }
    seen.add(source.source_id);
  }

  return { sources, taxonomy, normalization, ui };
}
