import { SelectProps } from "@cloudscape-design/components";

export abstract class OptionsHelper {
  static getSelectOption(model?: string): SelectProps.Option | null {
    if (!model) return null;
    const [, name] = model.split("::") ?? [];
    if (!name) return null;

    return {
      label: name,
      value: model,
    };
  }

  static parseValue(value?: string) {
    const retValue = {
      provider: "",
      name: "",
    };

    try {
      if (!value) return retValue;
      const [provider, name] = value.split("::") ?? [];

      return {
        provider,
        name,
      };
    } catch (error) {
      console.error(error);
      return retValue;
    }
  }

  static getSelectOptionGroups<
    T extends {
      provider: string;
      name: string;
      interface?: string;
      isAgent?: boolean;
      isAgentUpdated?: boolean;
    },
  >(data: T[]) {
    const modelsMap = new Map<string, T[]>();
    data.forEach((item) => {
      const group = `${item.provider}:${item.interface}`;
      let items = modelsMap.get(group);
      if (!items) {
        items = [];
        modelsMap.set(group, [item]);
      } else {
        modelsMap.set(group, [...items, item]);
      }
    });

    const keys = [...modelsMap.keys()];
    keys.sort((a, b) => a.localeCompare(b));

    const options: SelectProps.OptionGroup[] = keys.map((key) => {
      const items = modelsMap.get(key);
      items?.sort((a, b) => a.name.localeCompare(b.name));
      return {
        label: this.getProviderLabel(key),
        options:
          items?.map((item) => ({
            label:
              item.name +
              (item.isAgent ? (item.isAgentUpdated! ? " ⭐️" : " ✅") : ""),
            value: `${item.provider}::${item.name}`,
          })) ?? [],
      };
    });

    return options;
  }

  static getSelectOptions<T extends { id: string; name: string }>(data: T[]) {
    data?.sort((a, b) => a.name.localeCompare(b.name));

    const options: SelectProps.Option[] = data.map((item) => {
      return {
        label: item.name,
        value: item.id,
      };
    });

    return options;
  }

  static getProviderLabel(provider: string) {
    let label = provider;
    if (label === "sagemaker") label = "SageMaker";
    else if (label === "bedrock") label = "Bedrock";
    else if (label === "openai") label = "OpenAI";

    return label;
  }
}
