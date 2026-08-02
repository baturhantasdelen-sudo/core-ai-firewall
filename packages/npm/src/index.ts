export interface NexusConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class NexusShield {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config?: NexusConfig) {
    this.baseUrl = (config?.baseUrl || "http://localhost:8080/v1").replace(/\/$/, "");
    this.apiKey = config?.apiKey;
  }

  public getProxyUrl(): string {
    return this.baseUrl;
  }

  public getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    return headers;
  }
}
