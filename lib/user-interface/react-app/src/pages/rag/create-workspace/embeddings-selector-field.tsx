import { FormField, Select, SelectProps } from "@cloudscape-design/components";
import { LoadingStatus } from "../../../common/types";
import { EmbeddingsModelHelper } from "../../../common/helpers/embeddings-model-helper";
import { useContext, useEffect, useState } from "react";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { EmbeddingModel } from "../../../API";
import { Utils } from "../../../common/utils";

interface EmbeddingsSelectionProps {
  submitting: boolean;
  selectedModel: SelectProps.Option | null;
  onChange: (data: Partial<{ embeddingsModel: SelectProps.Option }>) => void;
  errors: Record<string, string | string[]>;
}

export default function EmbeddingSelector(props: EmbeddingsSelectionProps) {
  const appContext = useContext(AppContext);
  const [embeddingsModelsStatus, setEmbeddingsModelsStatus] =
    useState<LoadingStatus>("loading");
  const [embeddingsModels, setEmbeddingsModels] = useState<EmbeddingModel[]>(
    []
  );

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.embeddings.getModels();

        setEmbeddingsModels(result.data!.listEmbeddingModels);
        setEmbeddingsModelsStatus("finished");
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setEmbeddingsModelsStatus("error");
      }
    })();
  }, [appContext]);

  const embeddingsModelOptions = EmbeddingsModelHelper.getSelectOptions(
    appContext,
    embeddingsModels
  );

  return (
    <FormField
      label="Embeddings Model"
      errorText={props.errors.embeddingsModel}
    >
      <Select
        disabled={props.submitting}
        selectedAriaLabel="Selected"
        placeholder="Choose an embeddings model"
        statusType={embeddingsModelsStatus}
        loadingText="Loading embeddings models (might take few seconds)..."
        selectedOption={props.selectedModel}
        options={embeddingsModelOptions}
        onChange={({ detail: { selectedOption } }) =>
          props.onChange({ embeddingsModel: selectedOption })
        }
      />
    </FormField>
  );
}
