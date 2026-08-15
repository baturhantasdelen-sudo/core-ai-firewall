-- P0 Sprint 1-2: Agent Discovery inventory (Supabase/Postgres)
-- Apply when persisting network discovery results beyond inline scan responses.

CREATE TABLE IF NOT EXISTS agent_inventory (
  id              TEXT PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN (
                    'LANGCHAIN', 'AUTOGEN', 'MCP_SERVER', 'CUSTOM_AGENT', 'SHADOW_AGENT'
                  )),
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
                    'ACTIVE', 'INACTIVE', 'QUARANTINED'
                  )),
  endpoint        TEXT NOT NULL,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  risk_score      INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  mcp_tools_count INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_inventory_org ON agent_inventory(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_inventory_type ON agent_inventory(type);
CREATE INDEX IF NOT EXISTS idx_agent_inventory_status ON agent_inventory(status);
CREATE INDEX IF NOT EXISTS idx_agent_inventory_risk ON agent_inventory(risk_score DESC);

ALTER TABLE agent_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_inventory_org_isolation ON agent_inventory
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
    )
  );
