import type { D1Like } from '../types';

export interface EnrichedArticle {
  what_changed: string;
  so_what: string;
  why_it_matters: string;
  generated_at: string;
  model_used?: string;
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
  const whatMatch = content.match(/===WHAT_CHANGED===\s*([\s\S]*?)(?===SO_WHAT===|$)/);
  const soWhatMatch = content.match(/===SO_WHAT===\s*([\s\S]*?)(?===WHY_IT_MATTERS===|$)/);
  const whyMatch = content.match(/===WHY_IT_MATTERS===\s*([\s\S]*?)(?=$)/);

  const what_changed = whatMatch?.[1]?.trim() || '';
  const so_what = soWhatMatch?.[1]?.trim() || '';
  const why_it_matters = whyMatch?.[1]?.trim() || '';

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
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
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
    .first();

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
