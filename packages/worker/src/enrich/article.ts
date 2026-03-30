import type { D1Like } from '../types';

export interface EnrichedArticle {
  what_changed: string;
  so_what: string;
  why_it_matters: string;
  generated_at: string;
  model_used?: string;
}

export class OpenRouterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'OpenRouterApiError';
  }
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface RawEventData {
  title: string;
  summary: string;
  raw_excerpt: string;
  platform: string;
  event_type: string;
  source_id: string;
}

function parseRetryAfterMs(retryAfter: string | null): number | undefined {
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const asDate = Date.parse(retryAfter);
  if (Number.isNaN(asDate)) return undefined;

  return Math.max(0, asDate - Date.now());
}

const PROMPT_TEMPLATE = `You are an expert AdTech analyst. Analyze the following platform change and provide a structured breakdown in three sections.

Platform: {{PLATFORM}}
Event Type: {{EVENT_TYPE}}
Title: {{TITLE}}

Raw Content:
{{RAW_CONTENT}}

Provide your analysis in this exact format:

===WHAT_CHANGED===
Clear summary of what was updated, released, deprecated, or changed. Be specific about the feature, API, or capability.

===SO_WHAT===
Explain the practical impact. What does this mean for developers, advertisers, or users? How should they respond?

===WHY_IT_MATTERS===
Strategic significance for the advertising ecosystem. Why is this change important in the broader context?

Each section should be 2-4 concise sentences.`;

export function buildPrompt(event: RawEventData): string {
  const rawContent = event.raw_excerpt || event.summary || '';

  return PROMPT_TEMPLATE
    .replace('{{PLATFORM}}', event.platform)
    .replace('{{EVENT_TYPE}}', event.event_type)
    .replace('{{TITLE}}', event.title)
    .replace('{{RAW_CONTENT}}', rawContent);
}

export function parseArticleResponse(content: string): EnrichedArticle {
  const extractSection = (startMarker: string, endMarker?: string): string => {
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) return '';

    const bodyStart = startIndex + startMarker.length;
    const endIndex = endMarker ? content.indexOf(endMarker, bodyStart) : -1;
    const section = endIndex === -1 ? content.slice(bodyStart) : content.slice(bodyStart, endIndex);
    return section.trim();
  };

  const what_changed = extractSection('===WHAT_CHANGED===', '===SO_WHAT===');
  const so_what = extractSection('===SO_WHAT===', '===WHY_IT_MATTERS===');
  const why_it_matters = extractSection('===WHY_IT_MATTERS===');

  return {
    what_changed,
    so_what,
    why_it_matters,
    generated_at: new Date().toISOString(),
  };
}

export async function generateArticleWithOpenRouter(
  event: RawEventData,
  apiKey: string,
  model: string = 'anthropic/claude-3.5-sonnet'
): Promise<EnrichedArticle> {
  const prompt = buildPrompt(event);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://at-radar.dev',
      'X-Title': 'AdTech Change Radar',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new OpenRouterApiError(
      `OpenRouter API error: ${response.status} - ${error}`,
      response.status,
      parseRetryAfterMs(response.headers.get('retry-after')),
    );
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from OpenRouter');
  }

  const article = parseArticleResponse(content);
  article.model_used = model;

  return article;
}

export async function getCachedArticle(
  db: D1Like,
  eventId: string
): Promise<EnrichedArticle | null> {
  const result = await db
    .prepare(`
      SELECT what_changed, so_what, why_it_matters, generated_at, model_used
      FROM enriched_articles
      WHERE event_id = ? AND error_message IS NULL
    `)
    .bind(eventId)
    .first<{
      what_changed: string;
      so_what: string;
      why_it_matters: string;
      generated_at: string;
      model_used?: string | null;
    }>();

  if (!result) return null;

  return {
    what_changed: result.what_changed as string,
    so_what: result.so_what as string,
    why_it_matters: result.why_it_matters as string,
    generated_at: result.generated_at as string,
    model_used: result.model_used as string | undefined,
  };
}

export async function cacheArticle(
  db: D1Like,
  eventId: string,
  article: EnrichedArticle,
  error?: string
): Promise<void> {
  const articleId = `${eventId}_v1`;

  await db
    .prepare(`
      INSERT INTO enriched_articles (
        article_id, event_id, what_changed, so_what, why_it_matters,
        generated_at, error_message, model_used
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET
        what_changed = excluded.what_changed,
        so_what = excluded.so_what,
        why_it_matters = excluded.why_it_matters,
        generated_at = excluded.generated_at,
        error_message = excluded.error_message,
        model_used = excluded.model_used,
        retry_count = retry_count + 1
    `)
    .bind(
      articleId,
      eventId,
      article.what_changed || '',
      article.so_what || '',
      article.why_it_matters || '',
      article.generated_at,
      error || null,
      (article as any).model_used || null
    )
    .run();
}

export async function enrichEvent(
  db: D1Like,
  eventId: string,
  eventData: RawEventData,
  apiKey: string,
  skipCache: boolean = false
): Promise<EnrichedArticle | null> {
  // Check cache first
  if (!skipCache) {
    const cached = await getCachedArticle(db, eventId);
    if (cached) {
      return cached;
    }
  }

  // Generate new article
  try {
    const article = await generateArticleWithOpenRouter(eventData, apiKey);
    await cacheArticle(db, eventId, article);
    return article;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await cacheArticle(db, eventId, {
      what_changed: '',
      so_what: '',
      why_it_matters: '',
      generated_at: new Date().toISOString(),
    }, errorMessage);
    return null;
  }
}
