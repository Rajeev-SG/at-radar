import { createTwoFilesPatch } from 'diff';

export function buildUnifiedDiff(previousText: string, nextText: string, label = 'doc'): string {
  return createTwoFilesPatch(`${label}:before`, `${label}:after`, previousText, nextText, '', '', {
    context: 2,
  });
}
