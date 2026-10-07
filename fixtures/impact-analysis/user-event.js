/* global define -- Fake SuiteScript source; contains no client data. */
define(['N/record'], function (record) {
  function beforeSubmit(context) {
    const order = context.newRecord;
    const value = order.getValue({ fieldId: 'custbody_demo_flag' });
    // A dynamic candidate cannot establish the runtime field ID.
    const dynamicId = 'custbody_' + context.fieldSuffix;
    return { value, dynamicId, record };
  }
  return { beforeSubmit };
});
