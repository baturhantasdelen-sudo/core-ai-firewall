'use client';

import { MCPLeaderboardTable } from '@/components/benchmark/MCPLeaderboardTable';
import type { McpLeaderboardView } from '@/types/mcp-leaderboard';

export function MCPLeaderboardSection({ initialData }: { initialData: McpLeaderboardView }) {
  return <MCPLeaderboardTable initialData={initialData} />;
}
