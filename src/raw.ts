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

// #[derive(Debug, Clone, Deserialize)]
// pub struct FullChoice {
//     pub index: i64,
//     pub finish_reason: Option<FinishReason>,
//     // logprobs aren't supported in most of providers
//     pub logprobs: Option<f64>,
//     pub message: OutputMessage,
// }

// #[derive(Debug, Clone, Deserialize)]
// pub struct CompletionResponse {
//     pub choices: Option<Vec<FullChoice>>,
//     pub error: Option<ErrorInfo>,
// }

// #[derive(Debug, Clone, Deserialize)]
// pub struct OutputMessage {
//     pub role: String,
//     pub content: String,
//     pub reasoning: Option<String>,
// }
