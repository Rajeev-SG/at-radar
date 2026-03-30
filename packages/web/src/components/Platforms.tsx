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

interface PlatformCount {
  platform: string;
  count: number;
}

interface Event {
  event_id: string;
  title: string;
  platform: string;
  event_type: string;
  published_at: string;
  severity?: string;
}

export function Platforms() {
  const [platforms, setPlatforms] = useState<PlatformCount[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [events, setEvents] = useState<Event[]>([]);
  const api = apiBase();

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const res = await fetch(`${api}/api/platforms`);
        const data = await res.json();
        const platformList = data.items || [];
        setPlatforms(platformList);
        if (platformList.length > 0 && !selectedPlatform) {
          setSelectedPlatform(platformList[0].platform);
        }
      } catch (error) {
        console.error('Failed to fetch platforms:', error);
      }
    };
    fetchPlatforms();
  }, [api, selectedPlatform]);

  useEffect(() => {
    if (!selectedPlatform) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch(
          `${api}/api/events?platform=${encodeURIComponent(selectedPlatform)}&limit=10`
        );
        const data = await res.json();
        setEvents(data.items || []);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    };
    fetchEvents();
  }, [selectedPlatform, api]);

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
        <h2 className="text-2xl font-semibold mb-1">Platforms</h2>
        <p className="text-muted-foreground">Latest changes grouped by platform.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="radar-panel">
          <h3 className="font-semibold mb-4">Platform Counts</h3>
          <div className="space-y-2">
            {platforms.map((p) => (
              <div
                key={p.platform}
                className={`flex justify-between items-center py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                  selectedPlatform === p.platform
                    ? 'bg-primary/10'
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedPlatform(p.platform)}
              >
                <span className="font-medium">{p.platform}</span>
                <Badge variant="outline">{p.count}</Badge>
              </div>
            ))}
            {platforms.length === 0 && (
              <p className="text-muted-foreground text-sm">No platforms found.</p>
            )}
          </div>
        </div>

        <div className="radar-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Latest For Selected Platform</h3>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Choose platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.platform} value={p.platform}>
                    {p.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  No events for this platform.
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card key={event.event_id} className="radar-card">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="capitalize">
                        {event.event_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.published_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm">
                      <a
                        href={`/events?id=${encodeURIComponent(event.event_id)}`}
                        className="hover:text-primary hover:underline"
                      >
                        {event.title}
                      </a>
                    </h4>
                    {event.severity && (
                      <Badge
                        variant={getSeverityBadgeVariant(event.severity)}
                        className="mt-2"
                      >
                        {event.severity}
                      </Badge>
                    )}
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
