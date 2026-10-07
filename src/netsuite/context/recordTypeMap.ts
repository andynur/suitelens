/**
 * URL path → SuiteScript record type mapping.
 *
 * VERIFY: every entry. Paths come from common NetSuite UI URLs and must be confirmed in a
 * real account (see docs/verification). Community PRs extend this table; add a parser test
 * for each new entry (tests in detect.test.ts).
 *
 * `confidence: 'high'` = widely observed URL; `'medium'` = believed correct, not yet confirmed.
 */
export type RecordTypeMapping = {
  /** Path of the `.nl` page, lowercase, without query string. */
  path: string;
  recordType: string;
  /** English label, used for display and to match SuiteQL display values. */
  label: string;
  confidence: 'high' | 'medium';
};

export const RECORD_TYPE_MAP: readonly RecordTypeMapping[] = [
  // Transactions
  {
    path: '/app/accounting/transactions/salesord.nl',
    recordType: 'salesorder',
    label: 'Sales Order',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/purchord.nl',
    recordType: 'purchaseorder',
    label: 'Purchase Order',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/custinvc.nl',
    recordType: 'invoice',
    label: 'Invoice',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/estimate.nl',
    recordType: 'estimate',
    label: 'Estimate',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/opprtnty.nl',
    recordType: 'opportunity',
    label: 'Opportunity',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/itemship.nl',
    recordType: 'itemfulfillment',
    label: 'Item Fulfillment',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/itemrcpt.nl',
    recordType: 'itemreceipt',
    label: 'Item Receipt',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/vendbill.nl',
    recordType: 'vendorbill',
    label: 'Vendor Bill',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/vendpymt.nl',
    recordType: 'vendorpayment',
    label: 'Bill Payment',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/custpymt.nl',
    recordType: 'customerpayment',
    label: 'Customer Payment',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/custcred.nl',
    recordType: 'creditmemo',
    label: 'Credit Memo',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/cashsale.nl',
    recordType: 'cashsale',
    label: 'Cash Sale',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/journal.nl',
    recordType: 'journalentry',
    label: 'Journal Entry',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/rtnauth.nl',
    recordType: 'returnauthorization',
    label: 'Return Authorization',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/trnfrord.nl',
    recordType: 'transferorder',
    label: 'Transfer Order',
    confidence: 'high',
  },
  {
    path: '/app/accounting/transactions/exprept.nl',
    recordType: 'expensereport',
    label: 'Expense Report',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/vendcred.nl',
    recordType: 'vendorcredit',
    label: 'Vendor Credit',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/deposit.nl',
    recordType: 'deposit',
    label: 'Deposit',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/check.nl',
    recordType: 'check',
    label: 'Check',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/workord.nl',
    recordType: 'workorder',
    label: 'Work Order',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/invadjst.nl',
    recordType: 'inventoryadjustment',
    label: 'Inventory Adjustment',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/transactions/vendauth.nl',
    recordType: 'vendorreturnauthorization',
    label: 'Vendor Return Authorization',
    confidence: 'medium',
  },
  // Entities
  {
    path: '/app/common/entity/custjob.nl',
    recordType: 'customer',
    label: 'Customer',
    confidence: 'high',
  },
  {
    path: '/app/common/entity/vendor.nl',
    recordType: 'vendor',
    label: 'Vendor',
    confidence: 'high',
  },
  {
    path: '/app/common/entity/employee.nl',
    recordType: 'employee',
    label: 'Employee',
    confidence: 'high',
  },
  {
    path: '/app/common/entity/contact.nl',
    recordType: 'contact',
    label: 'Contact',
    confidence: 'high',
  },
  {
    path: '/app/common/entity/partner.nl',
    recordType: 'partner',
    label: 'Partner',
    confidence: 'medium',
  },
  {
    path: '/app/accounting/project/project.nl',
    recordType: 'job',
    label: 'Project',
    confidence: 'medium',
  },
  // CRM
  {
    path: '/app/crm/support/supportcase.nl',
    recordType: 'supportcase',
    label: 'Case',
    confidence: 'high',
  },
  { path: '/app/crm/calendar/task.nl', recordType: 'task', label: 'Task', confidence: 'medium' },
  {
    path: '/app/crm/calendar/event.nl',
    recordType: 'calendarevent',
    label: 'Event',
    confidence: 'medium',
  },
  {
    path: '/app/crm/calendar/call.nl',
    recordType: 'phonecall',
    label: 'Phone Call',
    confidence: 'medium',
  },
  // Customization
  {
    path: '/app/common/scripting/script.nl',
    recordType: 'script',
    label: 'Script',
    confidence: 'medium',
  },
  {
    path: '/app/common/scripting/scriptrecord.nl',
    recordType: 'scriptdeployment',
    label: 'Script Deployment',
    confidence: 'medium',
  },
];

/**
 * Pages whose record type is not encoded in the path. The concrete type comes from the
 * DOM or the bridge (see detect.ts).
 */
export const GENERIC_RECORD_PATHS = {
  // VERIFY: custom records use rectype=<numeric id>&id=<record id>.
  customRecord: '/app/common/custom/custrecordentry.nl',
  // VERIFY: item pages share one path for every item subtype.
  item: '/app/common/item/item.nl',
  // VERIFY: generic transaction redirect page.
  transaction: '/app/accounting/transactions/transaction.nl',
} as const;

const BY_PATH = new Map(RECORD_TYPE_MAP.map((m) => [m.path, m]));
const BY_TYPE = new Map(RECORD_TYPE_MAP.map((m) => [m.recordType, m]));

export function findMappingByPath(path: string): RecordTypeMapping | undefined {
  return BY_PATH.get(path.toLowerCase());
}

export function findMappingByType(recordType: string): RecordTypeMapping | undefined {
  return BY_TYPE.get(recordType.toLowerCase());
}
