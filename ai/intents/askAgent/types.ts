export interface AskAgentDataCardItem {
  label: string;
  value: string;
}

export interface AskAgentDataCard {
  title: string;
  items: AskAgentDataCardItem[];
}

export interface AskAgentResult {
  answerMarkdown: string;
  dataCard: AskAgentDataCard | null;
  suggestions?: string[];
}

export interface AskAgentFinalResponse {
  type: 'final';
  markdown: string;
  suggestions?: string[];
  dataCard?: AskAgentDataCard;
}

export interface AskAgentToolCall {
  type: 'tool_call';
  tool: string;
  args?: Record<string, unknown>;
}
