export function apiBase(): string {
  return import.meta.env.PUBLIC_RADAR_API_URL || 'https://adtech-change-radar-api.rajeev-sgill.workers.dev';
}
