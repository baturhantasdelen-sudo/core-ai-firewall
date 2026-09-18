import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'vulnerable', guardrails: false });
});

/** Unprotected agent — executes any tool without intent verification. */
app.post('/agent/act', (req, res) => {
  const { intent, tool, args } = req.body ?? {};
  console.log(`[VULNERABLE] intent=${intent} tool=${tool} args=${JSON.stringify(args)}`);
  console.log(`ATTEMPTED ${String(tool).toUpperCase()} -> EXECUTED (NO GUARDRAILS)`);
  res.json({
    status: 'executed',
    warning: 'No runtime security layer — action ran unchecked',
    tool,
    args,
  });
});

app.listen(3001, () => {
  console.log('Vulnerable agent listening on :3001');
});
