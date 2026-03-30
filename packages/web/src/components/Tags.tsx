import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiBase } from '@/lib/api';

interface TagCount {
  tag: string;
  count: number;
}

interface Event {
  event_id: string;
  title: string;
  summary: string;
  platform: string;
  event_type: string;
  published_at: string;
  severity?: string;
}

interface TagsProps {
  initialTag?: string;
}

export function Tags({ initialTag }: TagsProps) {
  const [tags, setTags] = useState<TagCount[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>(initialTag || '');
  const [events, setEvents] = useState<Event[]>([]);
  const api = apiBase();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch(`${api}/api/tags`);
        const data = await res.json();
        const tagList = data.items || [];
        setTags(tagList);
        if (initialTag) {
          setSelectedTag(initialTag);
        } else if (tagList.length > 0 && !selectedTag) {
          setSelectedTag(tagList[0].tag);
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };
    fetchTags();
  }, [api, initialTag, selectedTag]);

  useEffect(() => {
    if (!selectedTag) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch(
          `${api}/api/events?tag=${encodeURIComponent(selectedTag)}&limit=10`
        );
        const data = await res.json();
        setEvents(data.items || []);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    };
    fetchEvents();
  }, [selectedTag, api]);

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
        <h2 className="text-2xl font-semibold mb-1">Tags</h2>
        <p className="text-muted-foreground">Browse changes by label.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="radar-panel">
          <h3 className="font-semibold mb-4">Available Tags</h3>
          <div className="space-y-2">
            {tags.map((t) => (
              <div
                key={t.tag}
                className={`flex justify-between items-center py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTag === t.tag ? 'bg-accent/10' : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedTag(t.tag)}
              >
                <span className="font-medium">{t.tag}</span>
                <Badge variant="outline">{t.count}</Badge>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-muted-foreground text-sm">No tags found.</p>
            )}
          </div>
        </div>

        <div className="radar-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Tag Events</h3>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Choose tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.tag} value={t.tag}>
                    {t.tag} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No events for this tag.
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card key={event.event_id} className="radar-card">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 text-xs">
                        <Badge variant="secondary" className="uppercase">
                          {event.platform}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {event.event_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      {event.severity && (
                        <Badge variant={getSeverityBadgeVariant(event.severity)}>
                          {event.severity}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium mb-1">
                      <a
                        href={`/events?id=${encodeURIComponent(event.event_id)}`}
                        className="hover:text-primary hover:underline"
                      >
                        {event.title}
                      </a>
                    </h4>
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {event.summary}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.published_at).toLocaleDateString()}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
