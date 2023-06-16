export interface AppConfig {
  aws_project_region: string;
  client: AppConfigClient;
}

export type AppConfigClient = AppConfigLambdaClient;

export enum AppConfigClientName {
  LAMBDA = 'lambda',
}

export interface AppConfigClientBase {
  name: AppConfigClientName;
}

export interface AppConfigLambdaClient extends AppConfigClientBase {
  name: AppConfigClientName.LAMBDA;
  send_endpoint: string;
  action_endpoint: string;
}

export enum ChatMessageSender {
  USER = 'user',
  SYSTEM = 'system',
}

export interface ChatMessage {
  generationId: string;
  sender: ChatMessageSender;
  content?: string;
  error: boolean;
}
