import { nowIso } from '../util';

export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  fetchedAt: string;
}

export interface HttpClient {
  fetchText(url: string, init?: RequestInit): Promise<FetchResult>;
}

export class FetchApiHttpClient implements HttpClient {
  async fetchText(url: string, init?: RequestInit): Promise<FetchResult> {
    const response = await fetch(url, init);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      url: response.url,
      status: response.status,
      headers,
      bodyText: await response.text(),
      fetchedAt: nowIso(),
    };
  }
}

export class FixtureHttpClient implements HttpClient {
  constructor(private readonly fixtures: Record<string, { bodyText: string; status?: number; headers?: Record<string, string> }>) {}

  async fetchText(url: string): Promise<FetchResult> {
    const fixture = this.fixtures[url];
    if (!fixture) throw new Error(`Missing fixture for URL ${url}`);
    return {
      url,
      status: fixture.status ?? 200,
      headers: fixture.headers ?? {},
      bodyText: fixture.bodyText,
      fetchedAt: nowIso(),
    };
  }
}

export async function robotsAllowed(_url: string): Promise<boolean> {
  return true;
}
