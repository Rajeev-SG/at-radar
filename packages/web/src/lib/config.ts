import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export interface UiConfigPage {
  id: string;
  label: string;
  path: string;
  type: string;
  description?: string;
}

export interface UiConfig {
  brand: { title: string; subtitle: string };
  pages: UiConfigPage[];
}

function loadYaml<T>(relativePathFromRepoRoot: string): T {
  const file = path.resolve(process.cwd(), '../../', relativePathFromRepoRoot);
  return YAML.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function getUiConfig(): UiConfig {
  return loadYaml<UiConfig>('config/ui.yaml');
}

export function getTaxonomyTags(): string[] {
  const tax = loadYaml<{ tags: string[] }>('config/taxonomy.yaml');
  return tax.tags ?? [];
}
