import type { DisclosureTarget } from '@/lib/disclosure/types';

/**
 * 15 organizations — 5 per vertical for unified responsible disclosure batch.
 *
 * `outreachEmail` — published or standard security/CISO contact per organization.
 * Production test safety: set DISCLOSURE_OUTBOUND_RECIPIENT in .env.local to route
 * ALL batch emails to a single inbox before removing the override for live outreach.
 */
export const DISCLOSURE_TARGETS: DisclosureTarget[] = [
  // YC AI SaaS (5)
  {
    id: 'agentgpt',
    slug: 'agentgpt',
    organizationName: 'AgentGPT (Reworkd)',
    vertical: 'yc-ai-saas',
    scanKind: 'github',
    scanSurface: 'https://github.com/reworkd/AgentGPT',
    referenceUrl: 'https://github.com/reworkd/AgentGPT',
    github: 'reworkd/AgentGPT',
    outreachEmail: 'security@agpt.co',
  },
  {
    id: 'crewai',
    slug: 'crewai',
    organizationName: 'CrewAI',
    vertical: 'yc-ai-saas',
    scanKind: 'github',
    scanSurface: 'https://github.com/crewAIInc/crewAI',
    referenceUrl: 'https://github.com/crewAIInc/crewAI',
    github: 'crewAIInc/crewAI',
    outreachEmail: 'security@crewai.com',
  },
  {
    id: 'dify',
    slug: 'dify-ai',
    organizationName: 'Dify AI',
    vertical: 'yc-ai-saas',
    scanKind: 'github',
    scanSurface: 'https://github.com/langgenius/dify',
    referenceUrl: 'https://github.com/langgenius/dify',
    github: 'langgenius/dify',
    outreachEmail: 'security@dify.ai',
  },
  {
    id: 'flowise',
    slug: 'flowise',
    organizationName: 'Flowise AI',
    vertical: 'yc-ai-saas',
    scanKind: 'github',
    scanSurface: 'https://github.com/FlowiseAI/Flowise',
    referenceUrl: 'https://github.com/FlowiseAI/Flowise',
    github: 'FlowiseAI/Flowise',
    outreachEmail: 'security@flowiseai.com',
  },
  {
    id: 'superagent',
    slug: 'superagent',
    organizationName: 'Superagent',
    vertical: 'yc-ai-saas',
    scanKind: 'github',
    scanSurface: 'https://github.com/superagent-ai/superagent',
    referenceUrl: 'https://github.com/superagent-ai/superagent',
    github: 'superagent-ai/superagent',
    outreachEmail: 'security@superagent.sh',
  },

  // FinTech & Open Banking MCP (5)
  {
    id: 'stripe-mcp',
    slug: 'stripe-mcp',
    organizationName: 'Stripe MCP Server',
    vertical: 'fintech-mcp',
    scanKind: 'github',
    scanSurface: 'https://github.com/modelcontextprotocol/servers/tree/main/src/stripe',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    github: 'modelcontextprotocol/servers',
    contentPath: 'src/stripe',
    outreachEmail: 'security@stripe.com',
  },
  {
    id: 'composio-fintech',
    slug: 'composio-fintech',
    organizationName: 'Composio (FinTech Integrations)',
    vertical: 'fintech-mcp',
    scanKind: 'github',
    scanSurface: 'https://github.com/ComposioHQ/composio',
    referenceUrl: 'https://github.com/ComposioHQ/composio',
    github: 'ComposioHQ/composio',
    outreachEmail: 'security@composio.dev',
  },
  {
    id: 'n8n-banking',
    slug: 'n8n-open-banking',
    organizationName: 'n8n Open Banking Workflows',
    vertical: 'fintech-mcp',
    scanKind: 'github',
    scanSurface: 'https://github.com/n8n-io/n8n',
    referenceUrl: 'https://github.com/n8n-io/n8n',
    github: 'n8n-io/n8n',
    outreachEmail: 'security@n8n.io',
  },
  {
    id: 'activepieces-finance',
    slug: 'activepieces-finance',
    organizationName: 'Activepieces Finance MCP',
    vertical: 'fintech-mcp',
    scanKind: 'github',
    scanSurface: 'https://github.com/activepieces/activepieces',
    referenceUrl: 'https://github.com/activepieces/activepieces',
    github: 'activepieces/activepieces',
    outreachEmail: 'security@activepieces.com',
  },
  {
    id: 'plaid-mcp-proxy',
    slug: 'plaid-mcp-proxy',
    organizationName: 'Plaid Banking MCP Proxy',
    vertical: 'fintech-mcp',
    scanKind: 'mcp',
    scanSurface: JSON.stringify({
      mcpServers: {
        plaid: {
          command: 'node',
          args: ['plaid-mcp-server.js'],
          tools: ['transfer_funds', 'read_accounts', 'bulk_export_transactions'],
        },
      },
    }),
    referenceUrl: 'https://plaid.com/docs/api/',
    outreachEmail: 'security@plaid.com',
  },

  // Enterprise TR Tech (5)
  {
    id: 'logo-yazilim',
    slug: 'logo-yazilim',
    organizationName: 'Logo Yazılım',
    vertical: 'enterprise-tr',
    scanKind: 'github',
    scanSurface: 'https://github.com/logo-yazilim',
    referenceUrl: 'https://www.logo.com.tr',
    github: 'logo-yazilim',
    outreachEmail: 'guvenlik@logo.com.tr',
  },
  {
    id: 'kocsistem',
    slug: 'kocsistem',
    organizationName: 'KoçSistem',
    vertical: 'enterprise-tr',
    scanKind: 'endpoint',
    scanSurface: 'https://www.kocsistem.com.tr',
    referenceUrl: 'https://www.kocsistem.com.tr',
    outreachEmail: 'security@kocsistem.com.tr',
  },
  {
    id: 'sabancidx',
    slug: 'sabancidx',
    organizationName: 'SabancıDx',
    vertical: 'enterprise-tr',
    scanKind: 'endpoint',
    scanSurface: 'https://www.sabancidx.com',
    referenceUrl: 'https://www.sabancidx.com',
    outreachEmail: 'security@sabancidx.com',
  },
  {
    id: 'eczacibasi-bilisim',
    slug: 'eczacibasi-bilisim',
    organizationName: 'Eczacıbaşı Bilişim',
    vertical: 'enterprise-tr',
    scanKind: 'endpoint',
    scanSurface: 'https://www.eczacibasi.com.tr',
    referenceUrl: 'https://www.eczacibasi.com.tr',
    outreachEmail: 'omer.erdem@eczacibasi.com.tr',
  },
  {
    id: 'turkcell-digital',
    slug: 'turkcell-digital',
    organizationName: 'Turkcell Dijital Servisler',
    vertical: 'enterprise-tr',
    scanKind: 'github',
    scanSurface: 'https://github.com/Turkcell',
    referenceUrl: 'https://www.turkcell.com.tr',
    github: 'Turkcell',
    outreachEmail: 'guvenlik@turkcell.com.tr',
  },
];

/** Alias used by outbound matrix / dispatcher docs */
export const TARGET_COMPANIES = DISCLOSURE_TARGETS;
