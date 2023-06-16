import { modelAdapterRegistry } from '../adapters/registry';

export function getModelAdapter(modelId: string, modelKwargs: any): any {
  const adapter = modelAdapterRegistry.get(modelId);
  return new adapter({
    modelId,
    modelKwargs,
  });
}
