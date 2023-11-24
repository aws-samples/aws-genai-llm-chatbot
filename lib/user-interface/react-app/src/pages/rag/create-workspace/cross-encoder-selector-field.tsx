import { useContext, useEffect, useState } from "react";
import { ApiClient } from "../../../common/api-client/api-client";
import {
  CrossEncoderModelItem,
  LoadingStatus,
  ResultValue,
} from "../../../common/types";
import { AppContext } from "../../../common/app-context";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { Select, SelectProps } from "@cloudscape-design/components";

interface CrossEncoderSelectorProps {
  submitting: boolean;
  onChange: (data: Partial<{ crossEncoderModel: SelectProps.Option }>) => void;
  selectedModel: SelectProps.Option | null;
  errors: Record<string, string | string[]>;
}

export function CrossEncoderSelectorField(props: CrossEncoderSelectorProps) {
  const appContext = useContext(AppContext);
  const [crossEncoderModelsStatus, setCrossEncoderModelsStatus] =
    useState<LoadingStatus>("loading");
  const [crossEncoderModels, setCrossEncoderModels] = useState<
    CrossEncoderModelItem[]
  >([]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.crossEncoders.getModels();

      if (ResultValue.ok(result)) {
        setCrossEncoderModels(result.data);
        setCrossEncoderModelsStatus("finished");
      } else {
        setCrossEncoderModelsStatus("error");
      }
    })();
  }, [appContext]);

  const crossEncoderModelOptions =
    OptionsHelper.getSelectOptionGroups(crossEncoderModels);

  return (
    <Select
      disabled={props.submitting}
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
  );
}
