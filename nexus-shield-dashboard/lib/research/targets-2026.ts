import type { ResearchTarget } from '@/lib/research/types';

const MCP_MONOREPO = 'modelcontextprotocol/servers';

function mcpServer(slug: string, serverDir: string): ResearchTarget {
  const name = `mcp-servers/${serverDir}`;
  return {
    id: slug,
    slug: name,
    name,
    category: 'mcp',
    github: MCP_MONOREPO,
    githubUrl: `https://github.com/${MCP_MONOREPO}/tree/main/src/${serverDir}`,
    contentPath: `src/${serverDir}`,
  };
}

function framework(slug: string, github: string): ResearchTarget {
  const [owner, repo] = github.split('/');
  return {
    id: slug,
    slug: github,
    name: github,
    category: 'framework',
    github,
    githubUrl: `https://github.com/${github}`,
    contentPath: undefined,
  };
}

/** 50 open-source targets — 25 agent frameworks/templates + 25 MCP servers */
export const RESEARCH_TARGETS_2026: ResearchTarget[] = [
  // AI Agent Frameworks / Templates (25)
  framework('langchain', 'langchain-ai/langchain'),
  framework('langchainjs', 'langchain-ai/langchainjs'),
  framework('crewai', 'crewAIInc/crewAI'),
  framework('autogpt', 'Significant-Gravitas/AutoGPT'),
  framework('llama-index', 'run-llama/llama_index'),
  framework('autogen', 'microsoft/autogen'),
  framework('phidata', 'agno-agi/agno'),
  framework('astro-cli', 'astronomer/astro-cli'),
  framework('superagent', 'superagent-ai/superagent'),
  framework('e2b', 'e2b-dev/E2B'),
  framework('agentgpt', 'reworkd/AgentGPT'),
  framework('babyagi', 'yoheinakajima/babyagi'),
  framework('composio', 'ComposioHQ/composio'),
  framework('smol-developer', 'smol-ai/developer'),
  framework('chatdev', 'OpenBMB/ChatDev'),
  framework('shoggoth', 'ShoggothAI/shoggoth'),
  framework('agent-template-assaf', 'assafmo/agent-template'),
  framework('agent-template-langchain', 'langchain-ai/agent-protocol-toolkit'),
  framework('crewai-examples', 'crewAIInc/crewAI-examples'),
  framework('llama-agents', 'run-llama/llama_index'),
  framework('dify', 'langgenius/dify'),
  framework('flowise', 'FlowiseAI/Flowise'),
  framework('activepieces', 'activepieces/activepieces'),
  framework('n8n', 'n8n-io/n8n'),
  framework('swarms', 'kyegomez/swarms'),

  // MCP Servers (25)
  {
    id: 'mcp-servers-root',
    slug: 'modelcontextprotocol/servers',
    name: 'modelcontextprotocol/servers',
    category: 'mcp',
    github: MCP_MONOREPO,
    githubUrl: `https://github.com/${MCP_MONOREPO}`,
  },
  {
    id: 'awesome-mcp',
    slug: 'punkpeye/awesome-mcp-servers',
    name: 'punkpeye/awesome-mcp-servers',
    category: 'mcp',
    github: 'punkpeye/awesome-mcp-servers',
    githubUrl: 'https://github.com/punkpeye/awesome-mcp-servers',
  },
  mcpServer('mcp-postgres', 'postgres'),
  mcpServer('mcp-sqlite', 'sqlite'),
  mcpServer('mcp-gdrive', 'gdrive'),
  mcpServer('mcp-slack', 'slack'),
  mcpServer('mcp-github', 'github'),
  mcpServer('mcp-puppeteer', 'puppeteer'),
  mcpServer('mcp-fetch', 'fetch'),
  mcpServer('mcp-memory', 'memory'),
  mcpServer('mcp-brave-search', 'brave-search'),
  mcpServer('mcp-git', 'git'),
  mcpServer('mcp-evernote', 'evernote'),
  mcpServer('mcp-sentry', 'sentry'),
  mcpServer('mcp-zendesk', 'zendesk'),
  mcpServer('mcp-linear', 'linear'),
  mcpServer('mcp-notion', 'notion'),
  mcpServer('mcp-stripe', 'stripe'),
  mcpServer('mcp-redis', 'redis'),
  mcpServer('mcp-aws-s3', 'aws-kb-retrieval'),
  mcpServer('mcp-elasticsearch', 'elasticsearch'),
  mcpServer('mcp-docker', 'docker'),
  mcpServer('mcp-kubernetes', 'kubernetes'),
  mcpServer('mcp-mongodb', 'mongodb'),
  mcpServer('mcp-jira', 'jira'),
];
