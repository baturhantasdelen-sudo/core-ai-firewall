export interface OwaspReference {
  title: string;
  url: string;
}

export interface OwaspThreatClassification {
  owasp_genai_top_10: string[];
  owasp_agentic: string[];
  primary_category?: string;
  references: OwaspReference[];
}
