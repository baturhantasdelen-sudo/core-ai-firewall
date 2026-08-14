import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  Crosshair,
  FileCode2,
  FileText,
  Radar,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  chip: string;
  external?: boolean;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    label: 'Setup Guide',
    href: '/dashboard',
    icon: BookOpen,
    chip: 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20 hover:text-zinc-100',
  },
  {
    label: 'Agents',
    href: '/dashboard/agents',
    icon: Bot,
    chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200 hover:border-violet-500/30 hover:bg-violet-500/20',
  },
  {
    label: 'Action Firewall',
    href: '/dashboard/actions',
    icon: ShieldAlert,
    chip: 'border-rose-500/20 bg-rose-500/10 text-rose-200 hover:border-rose-500/30 hover:bg-rose-500/20',
  },
  {
    label: 'Threat Intel',
    href: '/dashboard/threat-intel',
    icon: Radar,
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/30 hover:bg-indigo-500/20',
  },
  {
    label: 'Red Teaming',
    href: '/dashboard/simulator',
    icon: Crosshair,
    chip: 'border-orange-500/20 bg-orange-500/10 text-orange-200 hover:border-orange-500/30 hover:bg-orange-500/20',
  },
  {
    label: 'Trust Hub',
    href: '/dashboard/trust-hub',
    icon: ShieldCheck,
    chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:border-cyan-500/30 hover:bg-cyan-500/20',
  },
  {
    label: 'Compliance',
    href: '/dashboard/compliance',
    icon: FileText,
    chip: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:border-indigo-500/30 hover:bg-indigo-500/20',
  },
  {
    label: 'API Docs',
    href: '/docs',
    icon: FileCode2,
    chip: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/30 hover:bg-emerald-500/20',
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    chip: 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20 hover:text-zinc-100',
  },
];
