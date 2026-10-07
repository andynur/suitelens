/** AI Assist strings: suiteql. Spread into `en`. */
export const aiSuiteqlEn = {
  'ai.suiteql.title': 'Ask for SuiteQL',
  'ai.suiteql.intro':
    'Describe the data you need. Only table and column names are sent, never record values. The query opens in SuiteQL and never runs on its own.',
  'ai.suiteql.question': 'Question',
  'ai.suiteql.placeholder': 'e.g. List the 10 latest sales orders with customer names',
  'ai.suiteql.ask': 'Ask',
  'ai.suiteql.previewTitle': 'Send SuiteQL question to AI',
  'ai.suiteql.fixtureMode': 'Fixture mode: answers come from the built-in demo provider.',
  'ai.suiteql.indexStatus':
    'Schema context: metadata index with {count, plural, one {# table} other {# tables}}.',
  'ai.suiteql.indexFailed':
    'Could not read the metadata index. The built-in list of common tables is used.',
  'ai.suiteql.noIndex.title': 'No metadata index for this account yet',
  'ai.suiteql.noIndex.body':
    'You can still ask: the AI gets a built-in list of common tables, not your account’s tables and custom fields. Build the account metadata index in SuiteQL (History) for better results.',
  'ai.suiteql.openConsoleIndex': 'Open SuiteQL',
  'ai.suiteql.item.question': 'Question',
  'ai.suiteql.item.notes': 'Schema notes',
  'ai.suiteql.item.schema': 'Schema: {table} ({count, plural, one {# column} other {# columns}})',
  'ai.suiteql.item.builtin':
    'Common table (built-in): {table} ({count, plural, one {# column} other {# columns}})',
  'ai.suiteql.openInConsole': 'Open in SuiteQL',
  'ai.suiteql.check.ok.index': 'All tables and columns were found in the metadata index.',
  'ai.suiteql.check.ok.builtin':
    'All tables and columns are in the built-in list of common tables.',
  'ai.suiteql.check.title': 'Check before running',
  'ai.suiteql.source.index': 'the metadata index',
  'ai.suiteql.source.builtin': 'the built-in list',
  'ai.suiteql.issue.notSelect': 'This is not a read-only SELECT statement.',
  'ai.suiteql.issue.multipleStatements':
    'The answer has more than one statement. Run only one SELECT.',
  'ai.suiteql.issue.unknownTable': 'Table {table} is not in {source}.',
  'ai.suiteql.issue.unknownColumn': 'Column {table}.{column} is not in {source}.',
  'ai.suiteql.issue.unknownColumnAny': 'Column {column} is not in {source} for the tables used.',
  'ai.suiteql.issue.unknownAlias': '{alias}.{column} uses a table alias the query does not define.',
  'ai.suiteql.check.limits':
    'The index is partial and this check is a simple scan, so a name that is not listed may still exist. Running the query in SuiteQL is the real check.',
} as const;
