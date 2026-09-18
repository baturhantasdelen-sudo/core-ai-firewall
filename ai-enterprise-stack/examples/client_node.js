/**
 * Enterprise pilot client — official OpenAI Node SDK via NexusShield / ResoNet.
 *
 * Usage:
 *   npm install openai
 *   node examples/client_node.js resonet
 *   node examples/client_node.js nexusshield
 */

const OpenAI = require("openai");

const GATEWAY_BASE = process.env.AI_GATEWAY_BASE || "http://localhost:8080";
const MODULES = {
  nexusshield: `${GATEWAY_BASE}/nexus/v1`,
  resonet: `${GATEWAY_BASE}/resonet/v1`,
};

async function runChat(moduleName, prompt, model = "auto") {
  const baseURL = MODULES[moduleName];
  if (!baseURL) {
    throw new Error(`Unknown module: ${moduleName}`);
  }

  const client = new OpenAI({
    baseURL,
    apiKey: process.env.OPENAI_API_KEY || "gateway-pilot-key",
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    console.log("Module:", moduleName);
    console.log("Model:", response.model);
    console.log("Reply:", response.choices[0].message.content);
    console.log("Usage:", response.usage);
  } catch (error) {
    if (error.status) {
      console.error(`[ERROR] HTTP ${error.status}: ${error.message}`);
    } else if (error.code === "ECONNREFUSED") {
      console.error(`[ERROR] Gateway unreachable at ${baseURL}`);
    } else {
      console.error("[ERROR]", error.message || error);
    }
    process.exitCode = 1;
  }
}

const moduleName = process.argv[2] || "resonet";
const prompt =
  process.argv[3] ||
  "What is 2 + 2? Reply in one short sentence.";

runChat(moduleName, prompt);
