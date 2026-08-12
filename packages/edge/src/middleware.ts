import { createNexusShield } from "./sanitize.js";
import type { NexusShieldOptions, ShieldResult } from "./types.js";

const TEXT_FIELDS = new Set([
  "prompt",
  "input",
  "text",
  "content",
  "message",
  "query",
  "user_input",
]);

function mergeShieldResults(results: ShieldResult[]): ShieldResult | null {
  if (results.length === 0) {
    return null;
  }

  return {
    sanitizedInput: results.map((result) => result.sanitizedInput).join("\n"),
    piiDetected: results.some((result) => result.piiDetected),
    maskedTypes: [...new Set(results.flatMap((result) => result.maskedTypes))],
    latencyMs: results.reduce((total, result) => total + result.latencyMs, 0),
  };
}

function sanitizeValue(value: unknown, shield: ReturnType<typeof createNexusShield>): {
  value: unknown;
  results: ShieldResult[];
} {
  if (typeof value === "string") {
    const result = shield.sanitize(value);
    return {
      value: result.sanitizedInput,
      results: [result],
    };
  }

  if (Array.isArray(value)) {
    const results: ShieldResult[] = [];
    const sanitizedArray = value.map((item) => {
      const sanitized = sanitizeValue(item, shield);
      results.push(...sanitized.results);
      return sanitized.value;
    });
    return { value: sanitizedArray, results };
  }

  if (value && typeof value === "object") {
    const results: ShieldResult[] = [];
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (TEXT_FIELDS.has(key) && typeof nestedValue === "string") {
        const result = shield.sanitize(nestedValue);
        sanitizedObject[key] = result.sanitizedInput;
        results.push(result);
        continue;
      }

      const sanitized = sanitizeValue(nestedValue, shield);
      sanitizedObject[key] = sanitized.value;
      results.push(...sanitized.results);
    }

    return { value: sanitizedObject, results };
  }

  return { value, results: [] };
}

export function nexusShieldMiddleware(options: NexusShieldOptions = {}) {
  const shield = createNexusShield(options);

  return async (
    request: Request,
  ): Promise<{ request: Request; shieldResult: ShieldResult | null }> => {
    if (request.method !== "POST") {
      return { request, shieldResult: null };
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { request, shieldResult: null };
    }

    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      return { request, shieldResult: null };
    }

    const { value: sanitizedBody, results } = sanitizeValue(body, shield);
    const shieldResult = mergeShieldResults(results);

    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");

    const cleanRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: JSON.stringify(sanitizedBody),
    });

    return { request: cleanRequest, shieldResult };
  };
}
