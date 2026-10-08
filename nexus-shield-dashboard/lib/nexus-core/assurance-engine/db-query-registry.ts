/** Allowlisted read-only query templates — no arbitrary SQL from API. */

export interface RegisteredQueryTemplate {
  id: string;
  sql: string;
  max_rows: number;
}

const REGISTRY: RegisteredQueryTemplate[] = [
  {
    id: 'ledger_by_txn',
    sql: 'SELECT status, amount, currency FROM ledger WHERE transaction_id = $1 LIMIT 1',
    max_rows: 1,
  },
  {
    id: 'invoice_status',
    sql: 'SELECT status, balance FROM invoices WHERE invoice_id = $1 LIMIT 1',
    max_rows: 1,
  },
];

export function getQueryTemplate(id: string): RegisteredQueryTemplate | undefined {
  return REGISTRY.find((t) => t.id === id);
}

export function assertRegisteredQuery(sql: string): void {
  const allowed = REGISTRY.some((t) => t.sql.trim() === sql.trim());
  if (!allowed) {
    throw new Error('SQL query not in registered template registry');
  }
}
