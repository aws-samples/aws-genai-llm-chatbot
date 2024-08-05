import { SelectProps } from "@cloudscape-design/components";
import { EmbeddingModel } from "../../API";
import { AppConfig } from "../types";

export abstract class EmbeddingsModelHelper {
  static getSelectOption(model?: string): SelectProps.Option | null {
    if (!model) return null;
    const [, dimensions, name] = model.split("::") ?? [];
    if (!name) return null;

    return {
      label: `${name} (${dimensions})`,
      value: model,
    };
  }

  static parseValue(value?: string) {
    const retValue = {
      provider: "",
      dimensions: 0,
      name: "",
    };

    if (!value) return retValue;
    const [provider, dimensionsStr, name] = value.split("::") ?? [];
    let dimensions = parseInt(dimensionsStr);
    if (isNaN(dimensions)) dimensions = 0;

    return {
      provider,
      dimensions,
      name,
    };
  }

  static getSelectOptions(
    appContext: AppConfig | null,
    embeddingsModels: EmbeddingModel[]
  ) {
    const modelsMap = new Map<string, EmbeddingModel[]>();
    embeddingsModels.forEach((model) => {
      if (
        model.provider === "sagemaker" &&
        !appContext?.config.sagemaker_embeddings_enabled
      ) {
        return;
      }
      let items = modelsMap.get(model.provider);
      if (!items) {
        items = [];
        modelsMap.set(model.provider, [model]);
      } else {
        modelsMap.set(model.provider, [...items, model]);
      }
    });

    const keys = [...modelsMap.keys()];
    keys.sort((a, b) => a.localeCompare(b));

    const options: SelectProps.OptionGroup[] = keys.map((key) => {
      const items = modelsMap.get(key);
      items?.sort((a, b) => a.name.localeCompare(b.name));

      let label = key;
      if (label === "sagemaker") label = "SageMaker";
      else if (label === "bedrock") label = "Bedrock";
      else if (label === "openai") label = "OpenAI";

      return {
        label,
        options:
          items?.map((item) => ({
            label: `${item.name} (${item.dimensions})`,
            value: `${item.provider}::${item.dimensions}::${item.name}`,
          })) ?? [],
      };
    });

    return options;
  }
}
