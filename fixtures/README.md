# Fixtures

Fake NetSuite responses and page snapshots used by `FixtureAdapter`, unit tests and E2E tests.

**Fake data only.** Never commit data copied from a real NetSuite account (names, emails,
amounts, internal IDs from a client account). Account `1234567` / `1234567-sb1` is fictional.

| Folder | Content | Shape status |
| --- | --- | --- |
| `records/<recordType>-<id>.xml` | Response of a record URL with `xml=T` | VERIFY against a sandbox |
| `current-record/<recordType>-<id>.json` | What the bridge returns for `getCurrentRecordFields` | SuiteLens's own format |
| `suiteql/<queryId>.<variantId>.json` | `asMappedResults()` rows for each query variant | VERIFY column names/values |
| `custom-record-types.json` | numeric custom record type ID → script ID | Fixture helper |
| `pages/*.html` | Simplified NetSuite page snapshots for E2E | VERIFY DOM structure |

When a `VERIFY` item is confirmed or corrected in a real account, update the matching fixture
in the same PR.
