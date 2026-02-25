import type { ChangeEvent, Severity, TaxonomyConfig, TaxonomyRule } from '../types';
import { regexFromConfig } from '../util';

function applyRules(text: string, rules: TaxonomyRule[], event: ChangeEvent): void {
  for (const rule of rules) {
    const re = regexFromConfig(rule.pattern);
    if (!re.test(text)) continue;
    if (rule.add_tags?.length) {
      const set = new Set(event.labels ?? []);
      for (const tag of rule.add_tags) set.add(tag);
      event.labels = [...set];
    }
    if (rule.event_type) event.event_type = rule.event_type;
    if (rule.severity) event.severity = rule.severity as Severity;
  }
}

export function tagEvent(event: ChangeEvent, taxonomy: TaxonomyConfig): ChangeEvent {
  const next: ChangeEvent = { ...event, labels: [...(event.labels ?? [])] };
  const text = `${event.title}\n${event.summary}\n${event.raw_excerpt}`;
  applyRules(text, taxonomy.rules, next);
  const platformRules = taxonomy.platform_rules?.[event.platform];
  if (platformRules) applyRules(text, platformRules, next);
  next.labels = [...new Set(next.labels)];
  return next;
}
