import { isValidAccountId } from './context/environment';
import { findMappingByType, GENERIC_RECORD_PATHS } from './context/recordTypeMap';

/**
 * URL builders for NetSuite UI pages. Pure functions; navigation happens in the UI layer.
 * VERIFY: every path below in a real account.
 */

export function accountOrigin(accountId: string): string {
  if (!isValidAccountId(accountId)) throw new Error('Invalid NetSuite account ID');
  return `https://${accountId}.app.netsuite.com`;
}

const NUMERIC_ID = /^\d{1,18}$/;

export type GoToTarget =
  | { kind: 'mapped'; recordType: string; id: string }
  | { kind: 'transaction'; id: string }
  | { kind: 'customrecord'; customRecordTypeId: string; id: string };

/** Returns undefined when the target cannot be turned into a URL. */
export function buildRecordUrl(accountId: string, target: GoToTarget): string | undefined {
  if (!NUMERIC_ID.test(target.id)) return undefined;
  const origin = accountOrigin(accountId);
  switch (target.kind) {
    case 'mapped': {
      const mapping = findMappingByType(target.recordType);
      return mapping ? `${origin}${mapping.path}?id=${target.id}` : undefined;
    }
    case 'transaction':
      return `${origin}${GENERIC_RECORD_PATHS.transaction}?id=${target.id}`;
    case 'customrecord':
      if (!NUMERIC_ID.test(target.customRecordTypeId)) return undefined;
      return `${origin}${GENERIC_RECORD_PATHS.customRecord}?rectype=${target.customRecordTypeId}&id=${target.id}`;
  }
}

function link(accountId: string, path: string, id: string | undefined): string | undefined {
  if (!id || !NUMERIC_ID.test(id)) return undefined;
  return `${accountOrigin(accountId)}${path}?id=${id}`;
}

export const scriptRecordUrl = (accountId: string, id?: string) =>
  link(accountId, '/app/common/scripting/script.nl', id);

export const deploymentRecordUrl = (accountId: string, id?: string) =>
  link(accountId, '/app/common/scripting/scriptrecord.nl', id);

// VERIFY: File Cabinet item page path.
export const fileCabinetUrl = (accountId: string, id?: string) =>
  link(accountId, '/app/common/media/mediaitem.nl', id);

// VERIFY: workflow record page path.
export const workflowRecordUrl = (accountId: string, id?: string) =>
  link(accountId, '/app/common/workflow/setup/nextgen/workflowdesktop.nl', id);
