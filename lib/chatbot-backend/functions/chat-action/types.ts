export interface LambdaEvent {
  headers: {
    idtoken?: string;
  };
  queryStringParameters?: { [key: string]: string };
  body: string;
}
