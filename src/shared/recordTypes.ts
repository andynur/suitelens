/**
 * Display names for common standard record types (header identity). Unknown types, including
 * custom records, fall back to the record type ID; no metadata request is made for this.
 */
const LABELS: Record<string, string> = {
  salesorder: 'Sales Order',
  invoice: 'Invoice',
  estimate: 'Estimate',
  opportunity: 'Opportunity',
  cashsale: 'Cash Sale',
  creditmemo: 'Credit Memo',
  customerpayment: 'Customer Payment',
  customerdeposit: 'Customer Deposit',
  returnauthorization: 'Return Authorization',
  itemfulfillment: 'Item Fulfillment',
  itemreceipt: 'Item Receipt',
  purchaseorder: 'Purchase Order',
  purchaserequisition: 'Requisition',
  vendorbill: 'Vendor Bill',
  vendorpayment: 'Vendor Payment',
  vendorcredit: 'Vendor Credit',
  journalentry: 'Journal Entry',
  transferorder: 'Transfer Order',
  inventoryadjustment: 'Inventory Adjustment',
  workorder: 'Work Order',
  expensereport: 'Expense Report',
  customer: 'Customer',
  vendor: 'Vendor',
  employee: 'Employee',
  contact: 'Contact',
  partner: 'Partner',
  lead: 'Lead',
  prospect: 'Prospect',
  job: 'Project',
  supportcase: 'Case',
  task: 'Task',
  inventoryitem: 'Inventory Item',
  noninventoryitem: 'Non-inventory Item',
  serviceitem: 'Service Item',
  assemblyitem: 'Assembly Item',
  kititem: 'Kit Item',
};

export function recordTypeLabel(recordType: string): string {
  return LABELS[recordType.toLowerCase()] ?? recordType;
}
