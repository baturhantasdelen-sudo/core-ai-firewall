import { CrmVerticalAdapter } from '@/lib/nexus-core/adapters/vertical/crm-adapter';
import { ErpVerticalAdapter } from '@/lib/nexus-core/adapters/vertical/erp-adapter';
import { FinanceVerticalAdapter } from '@/lib/nexus-core/adapters/vertical/finance-adapter';
import type { VerticalAdapter } from '@/lib/nexus-core/adapters/vertical/types';

export * from '@/lib/nexus-core/adapters/vertical/types';
export { FinanceVerticalAdapter, ErpVerticalAdapter, CrmVerticalAdapter };

export function resolveVerticalAdapter(vertical: 'finance' | 'erp' | 'crm'): VerticalAdapter {
  switch (vertical) {
    case 'finance':
      return new FinanceVerticalAdapter();
    case 'erp':
      return new ErpVerticalAdapter();
    case 'crm':
      return new CrmVerticalAdapter();
  }
}
