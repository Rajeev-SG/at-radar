import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { apiBase } from '@/lib/api';

interface Event {
  event_id: string;
  title: string;
  summary: string;
  platform: string;
  event_type: string;
  published_at: string;
  severity?: string;
  labels?: string[];
}

interface Filters {
  q: string;
  platform: string;
  tag: string;
  event_type: string;
  severity: string;
}

interface TimelineProps {
  preset?: string;
}

export function Timeline({ preset }: TimelineProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [platforms, setPlatforms] = useState<{ platform: string; count: number }[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: '',
    platform: '',
    tag: '',
    event_type: '',
    severity: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const api = apiBase();

  // Apply preset on mount
  useEffect(() => {
    if (preset === 'breaking_90d') {
      setFilters((f) => ({ ...f, severity: 'high' }));
    } else if (preset === 'docs_week') {
      setFilters((f) => ({ ...f, event_type: 'docs_update' }));
    }
  }, [preset]);

  // Load platforms and tags
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [platformsRes, tagsRes] = await Promise.all([
          fetch(`${api}/api/platforms`),
          fetch(`${api}/api/tags`),
        ]);
        const platformsData = await platformsRes.json();
        const tagsData = await tagsRes.json();
        setPlatforms(platformsData.items || []);
        setTags(tagsData.items || []);
      } catch (error) {
        console.error('Failed to load options:', error);
      }
    };
    loadOptions();
  }, [api]);

  const fetchEvents = useCallback(
    async (append: boolean = false) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set('q', filters.q);
        if (filters.platform) params.set('platform', filters.platform);
        if (filters.tag) params.set('tag', filters.tag);
        if (filters.event_type) params.set('event_type', filters.event_type);
        if (filters.severity) params.set('severity', filters.severity);
        params.set('limit', '10');
        if (append && cursor) params.set('cursor', cursor);

        const res = await fetch(`${api}/api/events?${params}`);
        const data = await res.json();

        setCursor(data.next_cursor);
        setEvents((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [api, filters, cursor]
  );

  // Initial fetch and when filters change
  useEffect(() => {
    fetchEvents(false);
  }, [fetchEvents]);

  const handleReset = () => {
    setFilters({ q: '', platform: '', tag: '', event_type: '', severity: '' });
  };

  const handleApply = () => {
    fetchEvents(false);
  };

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

  return (
    <div className="space-y-6">
      <div className="radar-panel">
        <h2 className="text-2xl font-semibold mb-1">Timeline</h2>
        <p className="text-muted-foreground">Search, filter, and open normalized platform change events.</p>
      </div>

      <div className="radar-panel">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              type="search"
              placeholder="deprecation, v23, attribution"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Platform</Label>
            <Select
              value={filters.platform}
              onValueChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p.platform} value={p.platform}>
                    {p.platform} ({p.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tag</Label>
            <Select
              value={filters.tag}
              onValueChange={(v) => setFilters((f) => ({ ...f, tag: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.tag} value={t.tag}>
                    {t.tag} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={filters.event_type}
              onValueChange={(v) => setFilters((f) => ({ ...f, event_type: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="release">Release</SelectItem>
                <SelectItem value="deprecation">Deprecation</SelectItem>
                <SelectItem value="breaking_change">Breaking</SelectItem>
                <SelectItem value="docs_update">Docs Update</SelectItem>
                <SelectItem value="policy_update">Policy Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Severity</Label>
            <Select
              value={filters.severity}
              onValueChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApply} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Apply'}
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No events found.
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.event_id} className="radar-card">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                  <span>{new Date(event.published_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{event.platform}</span>
                  <span>•</span>
                  <span className="capitalize">{event.event_type.replace('_', ' ')}</span>
                </div>
                <h3 className="text-lg font-medium mb-2">
                  <a
                    href={`/events?id=${encodeURIComponent(event.event_id)}`}
                    className="hover:text-primary hover:underline"
                  >
                    {event.title}
                  </a>
                </h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {event.summary}
                </p>
                <div className="flex flex-wrap gap-1.5">
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
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {cursor && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => fetchEvents(true)} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
