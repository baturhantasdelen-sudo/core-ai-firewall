import type { ReactNode } from 'react';

export const metadata = {
  title: {
    template: '%s | Nexus Shield Research',
    default: 'Nexus Shield Research Reports',
  },
};

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return children;
}
