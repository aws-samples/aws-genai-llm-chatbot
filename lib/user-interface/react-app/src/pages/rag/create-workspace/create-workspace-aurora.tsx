import { SpaceBetween, Button, Form } from "@cloudscape-design/components";
import { useContext, useState } from "react";
import { AuroraWorkspaceCreateInput } from "../../../common/types";
import { useForm } from "../../../common/hooks/use-form";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { EmbeddingsModelHelper } from "../../../common/helpers/embeddings-model-helper";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { useNavigate } from "react-router-dom";
import RouterButton from "../../../components/wrappers/router-button";
import AuroraForm from "./aurora-form";
import { Utils } from "../../../common/utils";

const nameRegex = /^[\w+_-]+$/;
const metrics = [
  {
    value: "inner",
    label: "Negative inner product (<#>)",
  },
  {
    value: "cosine",
    label: "Cosine distance (<=>)",
  },
  {
    value: "l2",
    label: "Euclidean distance (L2 norm) (<->)",
  },
];

const defaults: AuroraWorkspaceCreateInput = {
  name: "",
  embeddingsModel: null,
  crossEncoderModel: null,
  languages: [{ value: "english", label: "English" }],
  metric: metrics[0].value,
  index: true,
  hybridSearch: false,
  chunkSize: 1000,
  chunkOverlap: 200,
};

export default function CreateWorkspaceAurora() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const { data, onChange, errors, validate } = useForm({
    initialValue: () => {
      const retValue = {
        ...defaults,
        embeddingsModel: EmbeddingsModelHelper.getSelectOption(
          appContext?.config.default_embeddings_model
        ),
        crossEncodingEnabled:
          appContext?.config.cross_encoders_enabled || false,
        hybridSearch: appContext?.config.cross_encoders_enabled || false,
        crossEncoderModel: OptionsHelper.getSelectOption(
          appContext?.config.default_cross_encoder_model
        ),
      };

      return retValue;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};
      const name = form.name.trim();

      if (name.trim().length === 0) {
        errors.name = "Workspace name is required";
      } else if (name.trim().length > 100) {
        errors.name = "Workspace name must be less than 100 characters";
      } else if (!nameRegex.test(name)) {
        errors.name =
          "Workspace name can only contain letters, numbers, underscores, and dashes";
      }

      if (!form.embeddingsModel) {
        errors.embeddingsModel = "Embeddings model is required";
      } else {
        const { provider } = EmbeddingsModelHelper.parseValue(
          form.embeddingsModel.value
        );

        if (provider === "bedrock" && form.chunkSize > 1000) {
          errors.chunkSize =
            "Chunk size must not greater than 1000 characters for Bedrock models";
        }
      }

      if (form.languages.length === 0) {
        errors.languages = "At least one language is required";
      } else if (form.languages.length > 3) {
        errors.languages = "You can select up to 3 languages";
      }

      if (form.chunkSize < 100) {
        errors.chunkSize = "Chunk size must be at least 100 characters";
      } else if (form.chunkSize > 10000) {
        errors.chunkSize = "Chunk size must be less than 10000 characters";
      }

      if (form.chunkOverlap < 0) {
        errors.chunkOverlap = "Chunk overlap must be zero or greater";
      } else if (form.chunkOverlap >= form.chunkSize) {
        errors.chunkOverlap = "Chunk overlap must be less than chunk size";
      }

      if (form.index && form.embeddingsModel) {
        const { dimensions } = EmbeddingsModelHelper.parseValue(
          form.embeddingsModel.value
        );

        if (dimensions > 2000) {
          errors.index =
            "Indexing is not supported for models with more than 2000 dimensions";
        }
      }

      return errors;
    },
  });

  const submitForm = async () => {
    if (!validate()) return;
    if (!appContext) return;

    setGlobalError(undefined);
    setSubmitting(true);

    const embeddingsModel = EmbeddingsModelHelper.parseValue(
      data.embeddingsModel?.value
    );

    let crossEncoderModel;
    const crossEncoderSelected =
      data.crossEncoderModel?.value !== "__none__" &&
      appContext?.config.cross_encoders_enabled;
    if (crossEncoderSelected) {
      crossEncoderModel = OptionsHelper.parseValue(
        data.crossEncoderModel?.value
      );
    }

    const apiClient = new ApiClient(appContext);
    try {
      const result = await apiClient.workspaces.createAuroraWorkspace({
        name: data.name.trim(),
        embeddingsModelProvider: embeddingsModel.provider,
        embeddingsModelName: embeddingsModel.name,
        crossEncoderModelProvider: crossEncoderModel?.provider,
        crossEncoderModelName: crossEncoderModel?.name,
        languages: data.languages.map((x) => x.value ?? ""),
        metric: data.metric,
        index: data.index,
        hybridSearch: data.hybridSearch && crossEncoderSelected,
        chunkingStrategy: "recursive",
        chunkSize: data.chunkSize,
        chunkOverlap: data.chunkOverlap,
      });

      navigate(`/rag/workspaces/${result.data?.createAuroraWorkspace.id}`);
      return;
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (e: any) {
      setSubmitting(false);
      console.error(
        /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
        `Invocation error: ${e.errors.map((x: any) => x.message).join("")}`
      );
      setGlobalError("Something went wrong");
    }
  };

  if (Utils.isDevelopment()) {
    console.log("re-render");
  }

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <RouterButton variant="link" href="/rag" disabled={submitting}>
              Cancel
            </RouterButton>
            <Button
              data-testid="create"
              variant="primary"
              onClick={submitForm}
              disabled={submitting}
            >
              Create Workspace
            </Button>
          </SpaceBetween>
        }
        errorText={globalError}
      >
        <AuroraForm
          data={data}
          crossEncodingEnabled={
            appContext?.config.cross_encoders_enabled || false
          }
          onChange={onChange}
          errors={errors}
          submitting={submitting}
          metrics={metrics}
        />
      </Form>
    </form>
  );
}
