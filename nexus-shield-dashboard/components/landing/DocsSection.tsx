export function DocsSection() {
  return (
    <section id="docs" className="scroll-mt-20 mx-auto max-w-5xl px-6 py-16">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          API Docs
        </h2>
        <p className="mt-3 text-sm text-zinc-500 sm:text-base">
          Route LLM traffic through Nexus Shield — OpenAI, Gemini, Claude, or Ollama. Zero changes
          to your business logic.
        </p>
      </div>

      <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-6 font-mono text-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="ml-2 text-xs text-zinc-500">Python · OpenAI SDK</span>
        </div>
        <pre className="overflow-x-auto text-zinc-300">
          <code>{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.nexusshield.ai/v1",
    api_key=os.environ["NEXUS_API_KEY"],
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": user_prompt}],
)`}</code>
        </pre>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">
        Multi-LLM proxy supports OpenAI-compatible endpoints, Google Gemini, and local Ollama
        models.
      </p>
    </section>
  );
}
