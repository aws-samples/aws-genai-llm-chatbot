import { AI21J2Adapter } from './ai21-j2';
import { ModelAdapterBase } from './base';
import { FalconAdapter } from './falcon';
import { LightGPTAdapter } from './lightgpt';
import { PythiaAdapter } from './pythia';
import { RedPajamaAdapter } from './redpajama';
import { ModelAdapterEntry } from '../types';

class AdapterRegistry {
  private registry: ModelAdapterEntry[] = [];

  add(pattern: RegExp, adapter: any): void {
    this.registry.push({ pattern, adapter });
  }

  get(modelId: string): ModelAdapterBase {
    for (const entry of this.registry) {
      if (entry.pattern.test(modelId)) {
        return entry.adapter;
      }
    }
    throw new Error(`No registered handler for modelId: ${modelId}`);
  }
}

const modelAdapterRegistry = new AdapterRegistry();

modelAdapterRegistry.add(/^amazon\/LightGPT/, LightGPTAdapter);
modelAdapterRegistry.add(/^OpenAssistant\/pythia/, PythiaAdapter);
modelAdapterRegistry.add(/^ai21\/j2/, AI21J2Adapter);
modelAdapterRegistry.add(/^togethercomputer\/RedPajama/, RedPajamaAdapter);
modelAdapterRegistry.add(/^tiiuae\/falcon/, FalconAdapter);

export { modelAdapterRegistry };
