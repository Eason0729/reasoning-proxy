export interface CompletionRequest {
  model?: string;
  stream?: boolean;
  messages?: Message[];
}

export interface Message {
  role?: string;
  content?: string;
  contents?: MessagePart[];
}

export interface MessagePart {
  "type": string;
  file?: string;
  text?: string;
}

export interface CompletionResponse {
  model: string;
  choices: Choice[];
}

export interface Choice {
  index: number;
  message: Message;
  reasoning?: string;
  reasoning_content?: string;
  finish_reason: string | null;
}
