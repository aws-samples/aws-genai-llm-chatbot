import { SageMakerLLMContentHandler } from 'langchain/llms/sagemaker_endpoint';

import { ModelAdapterBase } from './base';
import { ChatMode, ContentType, GetPromptArgs } from '../types';

const stopWords = ['<|endoftext|>', '<|prompter|>', '<|assistant|>'];

class PythiaContentHandler implements SageMakerLLMContentHandler {
  contentType = ContentType.APPLICATION_JSON;
  accepts = ContentType.APPLICATION_JSON;

  async transformInput(prompt: string, modelKwargs: Record<string, unknown>) {
    let max_new_tokens = 5;
    if (modelKwargs.mode === ChatMode.Standard) {
      max_new_tokens = 400;
    }

    const payload = {
      inputs: prompt,
      parameters: {
        do_sample: true,
        top_p: 0.7,
        top_k: 50,
        temperature: 0.5,
        repetition_penalty: 1.03,
        return_full_text: false,
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

export class PythiaAdapter extends ModelAdapterBase {
  getContentHandler() {
    return new PythiaContentHandler();
  }

  async getPrompt(args: GetPromptArgs) {
    console.log(args);
    const truncated = this.truncateArgs(args, 5000);
    const { prompt } = truncated;
    console.log(truncated);

    const historyString = truncated.history.map((h) => `${h.sender === 'user' ? '<|prompter|>' : '<|assistant|>'}${h.content}<|endoftext|>`).join('');
    const contextString = truncated.contextString.length > 0 ? `<|prompter|>${truncated.contextString}<|endoftext|>` : '';

    return `${historyString}${contextString}<|prompter>${prompt}<|endoftext|><|assistant|>`;
  }

  async getStopWords() {
    return stopWords;
  }
}
