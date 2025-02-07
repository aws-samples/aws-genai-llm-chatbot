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

  static parseWorkspaceValue(workspace?: SelectProps.Option): string {
    try {
      if (!workspace?.value) return "";

      const isExistingWorkspace =
        (workspace?.value.split("::") ?? []).length > 1;

      if (isExistingWorkspace) {
        return workspace.value;
      }

      return workspace?.label + "::" + workspace?.value;
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  static getSelectOptionGroups<T extends { provider: string; name: string }>(
    data: T[],
    addNone: boolean = false
  ): (SelectProps.OptionGroup | SelectProps.Option)[] {
    const modelsMap = new Map<string, T[]>();
    data.forEach((item) => {
      let items = modelsMap.get(item.provider);
      if (!items) {
        items = [];
        modelsMap.set(item.provider, [item]);
      } else {
        modelsMap.set(item.provider, [...items, item]);
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
            label: item.name,
            value: `${item.provider}::${item.name}`,
          })) ?? [],
      };
    });

    if (addNone) {
      return [
        {
          label: "None",
          value: "__none__",
        },
        ...options,
      ];
    }

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

  static getRolesSelectOptions<T extends string>(data: T[]) {
    data?.sort((a, b) => a.localeCompare(b));

    const options: SelectProps.Option[] = data.map((item) => {
      return {
        label: item,
        value: item,
      };
    });

    return options;
  }
}
