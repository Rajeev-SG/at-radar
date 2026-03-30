type BatchSummary = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ event_id: string; title: string; message: string }>;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;

    const [key, inlineValue] = current.slice(2).split('=', 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
      continue;
    }

    args.set(key, next);
    i += 1;
  }

  return args;
}

function readNumber(value: string | boolean | undefined, fallback?: number): number | undefined {
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function postBatch(url: string, token: string, body: Record<string, number | undefined>): Promise<BatchSummary> {
  const response = await fetch(`${url.replace(/\/$/, '')}/api/admin/enrich-all`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Batch enrichment failed: ${response.status} ${text}`);
  }

  return JSON.parse(text) as BatchSummary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = typeof args.get('url') === 'string' ? String(args.get('url')) : process.env.RADAR_API_URL || 'http://127.0.0.1:8787';
  const token = typeof args.get('token') === 'string' ? String(args.get('token')) : process.env.RADAR_ADMIN_TOKEN || 'local-dev-token';
  const limit = readNumber(args.get('limit'));
  const batchSize = readNumber(args.get('batch-size'), 5);
  const maxAttempts = readNumber(args.get('max-attempts'));
  const backoffBaseMs = readNumber(args.get('backoff-base-ms'));
  const maxBackoffMs = readNumber(args.get('max-backoff-ms'));
  const repeatUntilEmpty = args.get('all') === true;

  let run = 0;
  const totals: BatchSummary = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  while (true) {
    run += 1;
    const result = await postBatch(url, token, {
      limit,
      batch_size: batchSize,
      max_attempts: maxAttempts,
      backoff_base_ms: backoffBaseMs,
      max_backoff_ms: maxBackoffMs,
    });

    totals.processed += result.processed;
    totals.succeeded += result.succeeded;
    totals.failed += result.failed;
    totals.errors.push(...result.errors);

    console.log(
      `[run ${run}] processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed}`,
    );
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`  - ${error.event_id} :: ${error.title} :: ${error.message}`);
      }
    }

    if (!repeatUntilEmpty || result.processed === 0 || (limit != null && result.processed < limit)) {
      break;
    }
  }

  console.log('\nTotals');
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
