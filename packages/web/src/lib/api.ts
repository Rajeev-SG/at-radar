export function apiBase(): string {
  return import.meta.env.PUBLIC_RADAR_API_URL || 'http://127.0.0.1:8787';
}
