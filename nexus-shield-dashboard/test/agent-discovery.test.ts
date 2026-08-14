import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discoverAgents, discoverAgentsInFile } from '../lib/engine/discovery/index.ts';

const LANGCHAIN_AGENT = `
from langchain.agents import create_react_agent, AgentExecutor

tools = ["web_search", "read_file", "api_call"]
agent = create_react_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, name="Support ReAct Agent")
`;

const CREWAI_AGENT = `
from crewai import Agent, Crew

researcher = Agent(
  role="Ops Coordinator",
  goal="Run production workflows",
  tools=["sql_query", "run_command", "stripe_payment"],
  verbose=True,
)

crew = Crew(agents=[researcher], tasks=[])
`;

const OPENAI_ASSISTANT = `
import OpenAI
client = OpenAI()

assistant = client.beta.assistants.create(
  name="Customer Assistant",
  tools=[
    {"type": "function", "function": {"name": "read_file"}},
    {"type": "function", "function": {"name": "http_request"}},
  ],
)
`;

const MCP_CONFIG = `
{
  "mcpServers": {
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "tools": ["read_file", "write_file", "execute_shell"]
    },
    "web-search": {
      "transport": "sse",
      "url": "https://mcp.example.com/sse",
      "tools": ["web_search"]
    }
  }
}
`;

describe('agent & MCP discovery engine', () => {
  it('detects LangChain agents with tool capabilities', () => {
    const agents = discoverAgentsInFile('src/agents/support.py', LANGCHAIN_AGENT);
    assert.ok(agents.some((agent) => agent.framework === 'LangChain'));
    const langchain = agents.find((agent) => agent.framework === 'LangChain');
    assert.ok(langchain);
    assert.match(langchain!.name, /Support ReAct Agent|LangChain Agent/i);
    assert.ok(langchain!.capabilities.includes('WEB_SEARCH') || langchain!.capabilities.includes('READ'));
  });

  it('detects CrewAI agents with critical risk when exec and financial tools exist', () => {
    const agents = discoverAgentsInFile('src/agents/ops_crew.py', CREWAI_AGENT);
    const crewAgent = agents.find((agent) => agent.framework === 'CrewAI');
    assert.ok(crewAgent);
    assert.equal(crewAgent!.name, 'Ops Coordinator');
    assert.ok(crewAgent!.capabilities.includes('EXECUTE'));
    assert.ok(crewAgent!.capabilities.includes('FINANCIAL') || crewAgent!.capabilities.includes('DB_QUERY'));
    assert.equal(crewAgent!.riskLevel, 'CRITICAL');
  });

  it('detects OpenAI Assistant tool definitions', () => {
    const agents = discoverAgentsInFile('src/assistants/customer.ts', OPENAI_ASSISTANT);
    assert.ok(agents.some((agent) => agent.framework === 'OpenAI Assistants'));
    const assistant = agents.find((agent) => agent.framework === 'OpenAI Assistants');
    assert.equal(assistant!.name, 'Customer Assistant');
    assert.ok(assistant!.capabilities.length > 0);
  });

  it('parses MCP config JSON with stdio and sse transports', () => {
    const agents = discoverAgentsInFile('.mcp/config.json', MCP_CONFIG);
    assert.ok(agents.some((agent) => agent.framework === 'MCP' || agent.mcpConnections.length > 0));

    const bundle = agents.find((agent) => agent.framework === 'MCP') ?? agents[0];
    assert.equal(bundle.mcpConnections.length, 2);
    assert.ok(bundle.mcpConnections.some((connection) => connection.serverName === 'filesystem'));
    assert.ok(bundle.mcpConnections.some((connection) => connection.transport === 'sse'));
    assert.ok(bundle.capabilities.includes('EXECUTE') || bundle.capabilities.includes('WRITE'));
  });

  it('aggregates discovery metrics across multiple files', () => {
    const result = discoverAgents([
      { path: 'src/agents/support.py', content: LANGCHAIN_AGENT },
      { path: 'src/agents/ops_crew.py', content: CREWAI_AGENT },
      { path: '.mcp/config.json', content: MCP_CONFIG },
      { path: 'src/assistants/customer.ts', content: OPENAI_ASSISTANT },
    ]);

    assert.ok(result.total_agents >= 4);
    assert.ok(result.total_mcp_tools >= 3);
    assert.ok(result.critical_agents >= 1);
    assert.equal(result.agents.length, result.total_agents);
  });

  it('returns empty discovery for unrelated files', () => {
    const result = discoverAgents([
      { path: 'README.md', content: '# Nexus Shield\nNo agents here.' },
    ]);

    assert.equal(result.total_agents, 0);
    assert.equal(result.total_mcp_tools, 0);
    assert.equal(result.critical_agents, 0);
  });
});
