import { handleApiRequest } from './api/routes';
import { runIngestion, type IngestEnv } from './ingest/engine';

export interface Env extends IngestEnv {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleApiRequest(request, env as unknown as IngestEnv & { DB: any });
    } catch (error) {
      return Response.json(
        { error: 'internal_error', message: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runIngestion(env as unknown as IngestEnv & { DB: any }, { triggerType: 'cron' });
  },
};
