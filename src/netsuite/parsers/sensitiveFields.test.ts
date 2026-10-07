import { describe, expect, it } from 'vitest';
import { isSensitiveFieldId } from './sensitiveFields';

describe('isSensitiveFieldId', () => {
  it.each(['_csrf', '_eml_nkey_', '_anything', 'nsapitoken', 'sessionid', 'password2'])(
    'drops %s',
    (id) => expect(isSensitiveFieldId(id)).toBe(true),
  );

  it.each(['entity', 'custbody_iv_po_contract_type', 'tranid', 'billaddress', 'memo'])(
    'keeps %s',
    (id) => expect(isSensitiveFieldId(id)).toBe(false),
  );
});
