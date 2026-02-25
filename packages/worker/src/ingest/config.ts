import snapshot from '../generated/config.snapshot.json';
import type { ConfigBundle } from '../types';

export function getConfigBundle(): ConfigBundle {
  return snapshot as ConfigBundle;
}
