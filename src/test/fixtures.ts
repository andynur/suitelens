import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Test helpers to read files from /fixtures. */
const root = resolve(import.meta.dirname, '../../fixtures');

export const readFixture = (path: string): string => readFileSync(resolve(root, path), 'utf8');

export function loadFixturePage(name: string): Document {
  return new DOMParser().parseFromString(readFixture(`pages/${name}`), 'text/html');
}

export const SO_URL =
  'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';
