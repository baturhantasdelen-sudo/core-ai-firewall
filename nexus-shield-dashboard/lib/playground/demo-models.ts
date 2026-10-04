/** Enterprise agent / reasoning backends for the live sandbox demo (display + API `target_model`). */

export interface DemoModelOption {
  value: string;
  label: string;
}

export interface DemoModelGroup {
  id: string;
  label: string;
  options: DemoModelOption[];
}

export const DEMO_MODEL_GROUPS: DemoModelGroup[] = [
  {
    id: 'reasoning',
    label: 'Reasoning / Advanced',
    options: [
      { value: 'openai/o3', label: 'OpenAI o3 / GPT-5.5' },
      { value: 'anthropic/claude-4-opus', label: 'Anthropic Claude 4 Opus' },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise & Flagship',
    options: [
      { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
      { value: 'claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
      { value: 'gemini-2.0-pro', label: 'Google Gemini 2.0 Pro' },
    ],
  },
  {
    id: 'opensource',
    label: 'Open-Source / Self-Hosted',
    options: [{ value: 'llama-3.3-airgap', label: 'Llama 3.3 / 3.1 (Air-Gapped)' }],
  },
  {
    id: 'custom',
    label: 'Custom & Fine-Tuned',
    options: [
      {
        value: 'custom/enterprise-checkpoint',
        label: 'Custom Enterprise Checkpoint (Internal Weights)',
      },
    ],
  },
];

export const DEFAULT_DEMO_MODEL = 'gpt-4o';

export function demoModelLabel(value: string): string {
  for (const group of DEMO_MODEL_GROUPS) {
    const match = group.options.find((o) => o.value === value);
    if (match) return match.label;
  }
  return value;
}
