import { useContext, useEffect, useState } from "react";
import { ApiClient } from "../../../common/api-client/api-client";
import { LoadingStatus } from "../../../common/types";
import { AppContext } from "../../../common/app-context";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { FormField, Select, SelectProps } from "@cloudscape-design/components";
import { CrossEncoderData } from "../../../API";
import { Utils } from "../../../common/utils";

interface CrossEncoderSelectorProps {
  submitting: boolean;
  disabled: boolean;
  onChange: (data: Partial<{ crossEncoderModel: SelectProps.Option }>) => void;
  selectedModel: SelectProps.Option | null;
  errors: Record<string, string | string[]>;
}

export function CrossEncoderSelectorField(props: CrossEncoderSelectorProps) {
  const appContext = useContext(AppContext);
  const [crossEncoderModelsStatus, setCrossEncoderModelsStatus] =
    useState<LoadingStatus>("loading");
  const [crossEncoderModels, setCrossEncoderModels] = useState<
    CrossEncoderData[]
  >([]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.crossEncoders.getModels();

        /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
        setCrossEncoderModels(result.data?.listCrossEncoders!);
        setCrossEncoderModelsStatus("finished");
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setCrossEncoderModels([]);
        setCrossEncoderModelsStatus("error");
      }
    })();
  }, [appContext]);

  const crossEncoderModelOptions = OptionsHelper.getSelectOptionGroups(
    crossEncoderModels,
    true
  );

  return (
    <FormField
      label="Cross encoder"
      description="Use a cross encoder model to re-rank the results returned by the engine."
      errorText={props.errors.hybridSearch}
    >
      <Select
        disabled={props.submitting || props.disabled}
        selectedAriaLabel="Selected"
        placeholder="Choose a cross-encoder model"
        statusType={crossEncoderModelsStatus}
        loadingText="Loading cross-encoder models (might take few seconds)..."
        selectedOption={props.selectedModel}
        options={crossEncoderModelOptions}
        onChange={({ detail: { selectedOption } }) =>
          props.onChange({ crossEncoderModel: selectedOption })
        }
      />
    </FormField>
  );
}
