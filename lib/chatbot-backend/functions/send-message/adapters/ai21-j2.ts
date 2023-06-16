import { SageMakerLLMContentHandler } from 'langchain/llms/sagemaker_endpoint';

import { ModelAdapterBase } from './base';
import { ChatMode, ContentType, GetPromptArgs } from '../types';

const stopWords = ['##'];

class AI21J2ContentHandler implements SageMakerLLMContentHandler {
  contentType = ContentType.APPLICATION_JSON;
  accepts = ContentType.APPLICATION_JSON;

  async transformInput(prompt: string, modelKwargs: Record<string, unknown>) {
    let maxTokens = 5;
    if (modelKwargs.mode === ChatMode.Standard) {
      maxTokens = 400;
    }

    const payload = {
      prompt: prompt,
      numResults: 1,
      temperature: 0.5,
      topKReturn: 0,
      topP: 1,
      stopSequences: stopWords,
      maxTokens,
    };
    console.log(`Payload: ${JSON.stringify(payload)}`);
    return Buffer.from(JSON.stringify(payload));
  }

  async transformOutput(output: Uint8Array) {
    const responseJson = JSON.parse(Buffer.from(output).toString('utf-8'));
    console.log(`Response: ${JSON.stringify(responseJson)}`);

    return responseJson.completions[0].data.text;
  }
}

export class AI21J2Adapter extends ModelAdapterBase {
  getContentHandler() {
    return new AI21J2ContentHandler();
  }

  async getPrompt(args: GetPromptArgs) {
    console.log(args);
    const truncated = this.truncateArgs(args, 16000);
    const { prompt } = truncated;
    console.log(truncated);

    const historyString = truncated.history.map((h) => `${h.sender}: ${h.content}`).join('\n');
    const contextString = truncated.contextString.length > 0 ? truncated.contextString : 'No context.';

    let systemPrompt = `You are a helpful AI assistant. The following is a conversation between you (the system) and the user.\n${historyString || 'No history.'}\n\n`;
    systemPrompt += `This is the context for the current request:\n${contextString}\n`;
    systemPrompt += `Write a response that appropriately completes the request based on the context provided and the conversastion history.\nRequest:\n${prompt}\nResponse:\n`;

    return systemPrompt;
  }

  async getStopWords() {
    return stopWords;
  }
}
