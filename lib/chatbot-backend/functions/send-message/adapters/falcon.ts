import { SageMakerLLMContentHandler } from 'langchain/llms/sagemaker_endpoint';

import { ModelAdapterBase } from './base';
import { ChatMode, ContentType, GetPromptArgs } from '../types';

const stopWords = ['<|endoftext|>', '\nUser:', 'Falcon:', '</s>'];

class FalconContentHandler implements SageMakerLLMContentHandler {
  contentType = ContentType.APPLICATION_JSON;
  accepts = ContentType.APPLICATION_JSON;

  async transformInput(prompt: string, modelKwargs: Record<string, unknown>) {
    let max_new_tokens = 5;
    if (modelKwargs.mode === ChatMode.Standard) {
      max_new_tokens = 1024;
    }

    const payload = {
      inputs: prompt,
      parameters: {
        do_sample: true,
        top_p: 0.9,
        temperature: 0.8,
        repetition_penalty: 1.03,
        stop: stopWords,
        max_new_tokens,
      },
    };
    console.log(`Payload: ${JSON.stringify(payload)}`);
    return Buffer.from(JSON.stringify(payload));
  }

  async transformOutput(output: Uint8Array) {
    const responseJson = JSON.parse(Buffer.from(output).toString('utf-8'));
    console.log(`Response: ${JSON.stringify(responseJson)}`);

    return responseJson[0].generated_text;
  }
}

export class FalconAdapter extends ModelAdapterBase {
  getContentHandler() {
    return new FalconContentHandler();
  }

  async getPrompt(args: GetPromptArgs) {
    console.log(args);
    const truncated = this.truncateArgs(args, 5000);
    const { prompt } = truncated;
    console.log(truncated);

    const historyString = truncated.history.map((h) => `${h.sender === 'user' ? 'User:' : 'Falcon:'}${h.content}`).join('\n');
    const contextString = truncated.contextString.length > 0 ? `User:${truncated.contextString}` : '';

    return `You are an helpful Assistant, called Falcon. Knowing everyting about AWS.\n\n${historyString}\n${contextString}\nUser:${prompt}\nFalcon:`;
  }

  async getStopWords() {
    return stopWords;
  }
}
