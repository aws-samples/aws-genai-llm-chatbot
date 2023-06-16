import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({});

export interface SemanticSearchResult {
  id: number;
  url: string;
  content: string;
  score: number;
}

export class SemanticSearchClient {
  constructor(protected _functionArn: string) {}

  async search(query: string) {
    console.log(`Semantic search for: ${query}`);

    const encoder = new TextEncoder();
    const command = new InvokeCommand({
      FunctionName: this._functionArn,
      InvocationType: 'RequestResponse',
      Payload: encoder.encode(
        JSON.stringify({
          action: 'semantic-search',
          query: query,
          limit: 5,
          rerank: true,
        }),
      ),
    });

    const response = await lambdaClient.send(command);
    const responsePayload = response.Payload ? new TextDecoder().decode(response.Payload) : undefined;
    console.log(`Semantic search results: ${responsePayload}`);
    if (!responsePayload) {
      throw new Error('Empty response payload');
    }

    const retValue: SemanticSearchResult[] = JSON.parse(responsePayload);

    return retValue;
  }
}
