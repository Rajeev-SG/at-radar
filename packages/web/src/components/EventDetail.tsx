import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiBase } from '@/lib/api';
import { ExternalLink } from 'lucide-react';

interface Event {
  event_id: string;
  title: string;
  summary: string;
  platform: string;
  event_type: string;
  published_at: string;
  canonical_url: string;
  severity?: string;
  labels?: string[];
  effective_at?: string;
  versions_affected?: string[];
  entities_affected?: string[];
  diff?: { patch?: string };
  artifact?: {
    fetched_at: string;
    etag?: string;
    last_modified?: string;
    status_code?: number;
  };
  enriched_article?: {
    what_changed: string;
    so_what: string;
    why_it_matters: string;
    generated_at: string;
  };
}

interface EventDetailProps {
  eventId: string;
}

export function EventDetail({ eventId }: EventDetailProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const api = apiBase();

  useEffect(() => {
    const effectiveEventId =
      eventId || new URLSearchParams(window.location.search).get('id') || '';

    if (!effectiveEventId) {
      setError('No event ID provided');
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    const fetchEvent = async () => {
      try {
        const res = await fetch(`${api}/api/events/${encodeURIComponent(effectiveEventId)}`);
        if (!res.ok) throw new Error('not_found');
        const data = await res.json();
        setEvent(data);
      } catch (err) {
        setError('Event not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId, api]);

  const getSeverityBadgeVariant = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="radar-panel">
        <p className="text-muted-foreground">Loading event...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="radar-panel">
        <p className="text-muted-foreground">{error || 'Event not found'}</p>
      </div>
    );
  }

  const hasEnrichedArticle = event.enriched_article &&
    (event.enriched_article.what_changed || event.enriched_article.so_what || event.enriched_article.why_it_matters);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="radar-panel">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
            <span>{new Date(event.published_at).toLocaleString()}</span>
            <span>•</span>
            <span>{event.platform}</span>
            <span>•</span>
            <span className="capitalize">{event.event_type.replace('_', ' ')}</span>
          </div>
          <h1 className="text-2xl font-semibold mb-4">{event.title}</h1>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {(event.labels || []).map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
            {event.severity && (
              <Badge variant={getSeverityBadgeVariant(event.severity)}>
                {event.severity}
              </Badge>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Summary</h3>
            <p className="text-sm">{event.summary}</p>
          </div>

          {/* Enriched Article Section */}
          {hasEnrichedArticle && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  AI-Generated Analysis
                </h3>

                {event.enriched_article!.what_changed && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">What Changed</h4>
                    <p className="text-sm text-muted-foreground">
                      {event.enriched_article!.what_changed}
                    </p>
                  </div>
                )}

                {event.enriched_article!.so_what && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">So What</h4>
                    <p className="text-sm text-muted-foreground">
                      {event.enriched_article!.so_what}
                    </p>
                  </div>
                )}

                {event.enriched_article!.why_it_matters && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Why It Matters</h4>
                    <p className="text-sm text-muted-foreground">
                      {event.enriched_article!.why_it_matters}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground italic">
                  Generated at {new Date(event.enriched_article!.generated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="mt-6">
            <Button asChild variant="outline" size="sm">
              <a href={event.canonical_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Open canonical source
              </a>
            </Button>
          </div>
        </div>

        {event.diff?.patch && (
          <div className="radar-panel">
            <h3 className="font-semibold mb-3">Diff</h3>
            <pre className="diff-pre text-xs">{event.diff.patch}</pre>
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="radar-panel">
          <h3 className="font-semibold mb-4">Details</h3>
          <div className="space-y-3 text-sm">
            {event.effective_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective</span>
                <span>{new Date(event.effective_at).toLocaleDateString()}</span>
              </div>
            )}
            {event.versions_affected && event.versions_affected.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versions</span>
                <span>{event.versions_affected.join(', ')}</span>
              </div>
            )}
            {event.entities_affected && event.entities_affected.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entities</span>
                <span className="text-right">{event.entities_affected.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {event.artifact && (
          <div className="radar-panel">
            <h3 className="font-semibold mb-4">Fetch Artifact</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fetched</span>
                <span>{new Date(event.artifact.fetched_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{event.artifact.status_code || 'n/a'}</span>
              </div>
              {event.artifact.etag && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ETag</span>
                  <span className="font-mono text-xs truncate max-w-[120px]">{event.artifact.etag}</span>
                </div>
              )}
              {event.artifact.last_modified && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last-Modified</span>
                  <span className="text-xs">{event.artifact.last_modified}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="radar-panel">
          <h3 className="font-semibold mb-4">Feeds</h3>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <a href={`${api}/api/feeds/rss`} target="_blank" rel="noreferrer">
                RSS Feed
              </a>
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <a href={`${api}/api/feeds/json`} target="_blank" rel="noreferrer">
                JSON Feed
              </a>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
