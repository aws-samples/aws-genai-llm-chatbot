import useOnFollow from "../../../common/hooks/use-on-follow";
import {
  BreadcrumbGroup,
  Button,
  Container,
  ContentLayout,
  Form,
  FormField,
  Header,
  Link,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  ExpandableSection,
  Textarea,
  Multiselect,
  Toggle,
  Popover,
} from "@cloudscape-design/components";
import BaseAppLayout from "../../../components/base-app-layout";
import { useContext, useEffect, useState } from "react";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import {
  EmbeddingsModelItem,
  LoadingStatus,
  ResultValue,
} from "../../../common/types";
import { useForm } from "../../../common/hooks/use-form";
import { MetricsHelper } from "../../../common/helpers/metrics-helper";
import { MetricsMatrix } from "./metrics-matrix";
import { EmbeddingsModelHelper } from "../../../common/helpers/embeddings-model-helper";
import { Utils } from "../../../common/utils";

export default function Embeddings() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [pinFirstInput, setPinFirstInput] = useState(false);
  const [embeddingsModelsStatus, setEmbeddingsModelsStatus] =
    useState<LoadingStatus>("loading");
  const [embeddingsModelsResults, setEmbeddingsModelsResults] = useState<
    EmbeddingsModelItem[]
  >([]);
  const [embeddings, setEmbeddings] = useState<number[][] | null>(null);
  const [metricsMatrices, setMetricsMatrices] = useState<
    {
      embeddingsVector: number[][];
      embeddingModel: string;
      cosineSimilarity: number[][];
      cosineDistance: number[][];
      innerProduct: number[][];
      l2: number[][];
    }[]
  >([]);
  const [embeddingModels, setEmbeddingModels] = useState<string[]>([]);

  const { data, onChange, errors, validate } = useForm({
    initialValue: () => {
      const retValue: {
        embeddingsModel: SelectProps.Option | null;
        input: string[];
      } = {
        embeddingsModel: EmbeddingsModelHelper.getSelectOption(
          appContext?.config.default_embeddings_model
        ),
        input: [""],
      };

      return retValue;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (!form.embeddingsModel) {
        errors.embeddingsModel = "Embeddings model is required";
      }

      for (let i = 0; i < form.input.length; i++) {
        const input = form.input[i];
        if (input.trim().length === 0) {
          errors.input = errors.input || [];
          if (Array.isArray(errors.input)) {
            errors.input[i] = "Input is required";
          }
        }

        if (input.trim().length > 10000) {
          errors.input = errors.input || [];
          if (Array.isArray(errors.input)) {
            errors.input[i] = "Max input length is 10000 characters";
          }
        }
      }

      return errors;
    },
  });

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.embeddings.getModels();

      if (ResultValue.ok(result)) {
        setEmbeddingsModelsResults(result.data);
        setEmbeddingsModelsStatus("finished");
      } else {
        setEmbeddingsModelsStatus("error");
      }
    })();
  }, [appContext]);

  const onLoadSampleData = () => {
    onChange({
      input: [
        "The dog chases the ball.",
        "A canine runs after a spherical object.",
        "The cat sleeps on the couch.",
        "An automobile is parked in the garage.",
        "The vehicle is stationary in a covered parking area.",
      ],
    });
  };

  const addInput = () => {
    const newInput = [...data.input];
    newInput.push("");
    onChange({ input: newInput });
  };

  const removeInput = (index: number) => {
    const newInput = [...data.input];
    newInput.splice(index, 1);
    onChange({ input: newInput });
  };

  const submitForm = async () => {
    if (!validate()) return;
    if (!appContext) return;

    setGlobalError(undefined);
    setSubmitting(true);
    setEmbeddings(null);

    const apiClient = new ApiClient(appContext);
    const results = embeddingModels.map((model) => {
      const { provider, name } = EmbeddingsModelHelper.parseValue(model);
      return apiClient.embeddings.getEmbeddings(
        provider,
        name,
        data.input.map((input) => input.trim())
      );
    });

    const matricesResults = [];
    await Promise.all(results);
    for (let i = 0; i < results.length; i++) {
      console.log(`getting results for ${i}`);
      const result = await results[i];
      if (ResultValue.ok(result)) {
        const matrices = MetricsHelper.matrices(result.data);
        console.log(` results ${i} OK`);
        matricesResults.push({
          embeddingModel: embeddingModels[i],
          embeddingsVector: result.data,
          ...matrices,
        });
      } else if (result.message) {
        setGlobalError(Utils.getErrorMessage(result));
      }
    }
    console.log(`setting matrices - ${matricesResults.length}`);
    setMetricsMatrices(matricesResults);
    setSubmitting(false);
  };

  const embeddingsModelOptions = EmbeddingsModelHelper.getSelectOptions(
    embeddingsModelsResults
  );

  if (Utils.isDevelopment()) {
    console.log("re-render");
  }

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: "AWS GenAI Chatbot",
              href: "/",
            },
            {
              text: "RAG",
              href: "/rag",
            },
            {
              text: "Embeddings",
              href: "/rag/embeddings",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Embedding is the process by which text is given numerical representation in a vector space."
            >
              Embeddings
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Form
              actions={
                <SpaceBetween
                  direction="horizontal"
                  size="l"
                  alignItems="center"
                >
                  {submitting && (
                    <StatusIndicator type="loading">Loading</StatusIndicator>
                  )}
                  <Button
                    data-testid="create"
                    disabled={submitting}
                    variant="primary"
                    onClick={submitForm}
                  >
                    Generate
                  </Button>
                </SpaceBetween>
              }
              errorText={globalError}
            >
              <SpaceBetween size="l">
                <Container header={<Header variant="h1">Model</Header>}>
                  <SpaceBetween size="l">
                    <SpaceBetween size="l" direction="horizontal">
                      <FormField
                        label="Embeddings Model"
                        errorText={errors.embeddingsModel}
                      >
                        <Multiselect
                          disabled={submitting}
                          selectedOptions={embeddingModels.map((em) => ({
                            label: EmbeddingsModelHelper.parseValue(em).name,
                            value: em,
                          }))}
                          loadingText="Loading embeddings models (might take few seconds)..."
                          options={embeddingsModelOptions}
                          onChange={({ detail }) => {
                            setEmbeddingModels(
                              detail.selectedOptions.map((s) => s.value!)
                            );
                          }}
                        />
                      </FormField>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>
                <Container header={<Header variant="h1">Inputs</Header>}>
                  <SpaceBetween size="l">
                    {data.input.map((input, index) => (
                      <FormField
                        key={index}
                        label={`Input ${index + 1}`}
                        errorText={errors.input?.[index]}
                        secondaryControl={
                          <Button
                            disabled={submitting || index === 0}
                            onClick={() => removeInput(index)}
                          >
                            Remove
                          </Button>
                        }
                        info={
                          index === 0 ? (
                            <Link onFollow={onLoadSampleData}>
                              load sample data
                            </Link>
                          ) : undefined
                        }
                      >
                        <Textarea
                          disabled={submitting}
                          value={input}
                          onChange={({ detail }) => {
                            const newInput = [...data.input];
                            newInput[index] = detail.value;
                            onChange({ input: newInput });
                          }}
                        />
                      </FormField>
                    ))}
                    <Button
                      disabled={submitting || data.input.length >= 5}
                      onClick={addInput}
                    >
                      Add new input
                    </Button>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            </Form>
            {
              //embeddings &&
              //embeddings.length > 1 &&
              metricsMatrices.length > 0 && (
                <SpaceBetween size="m">
                  <Toggle
                    checked={pinFirstInput}
                    onChange={({ detail }) => setPinFirstInput(detail.checked)}
                  >
                    Relative to first input
                  </Toggle>

                  {metricsMatrices.map((m) => (
                    <Container
                      key={m.embeddingModel}
                      header={
                        <Header variant="h2">
                          {
                            EmbeddingsModelHelper.parseValue(m.embeddingModel)
                              .name
                          }
                        </Header>
                      }
                    >
                      <SpaceBetween size ="xl">
                      <SpaceBetween
                        size="xl"
                        direction="horizontal"
                      >
                        {/* <FormField label="Cosine Distance">
                          <MetricsMatrix
                            values={m.cosineDistance}
                            min={1}
                            max={0}
                          />
                        </FormField> */}
                        <FormField label="Cosine Similarity">
                          <MetricsMatrix
                            values={m.cosineSimilarity}
                            min={0}
                            max={1}
                            pinFirstInput={pinFirstInput}
                          />
                        </FormField>
                        {/* <FormField label="Inner Product">
                          <MetricsMatrix values={m.innerProduct} min={0} max={1} pinFirstInput={pinFirstInput} />
                        </FormField> */}
                        <FormField label="Euclidean Distance (L2 Norm)">
                          <MetricsMatrix
                            values={m.l2}
                            min={1.3}
                            max={0}
                            pinFirstInput={pinFirstInput}
                          />
                        </FormField>
                      </SpaceBetween>
                      <ExpandableSection headerText="Embeddings vector">
                        <SpaceBetween size="xl">
                          {m.embeddingsVector?.map((embedding, index) => (
                            <FormField
                            key={index}
                              label={(<><Popover 
                                size="medium"
                                position="top"
                                triggerType="custom"
                                dismissButton={false}
                                content={<StatusIndicator type="success">Vector copied to clipboard</StatusIndicator>}>
                                <Button
                                  variant="inline-icon"
                                  iconName="copy"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      JSON.stringify(embedding)
                                    );
                                  }}
                                /></Popover>{`Input ${index + 1} [dimensions: ${
                                embedding.length
                              }, magnitude ${MetricsHelper.magnitude(
                                embedding
                              ).toFixed(2)}]`}</>)}
                              >
                              <Textarea
                                rows={5}
                                value={JSON.stringify(embedding)}
                                readOnly={true}

                              />
                            </FormField>
                          ))}
                        </SpaceBetween>
                      </ExpandableSection>
                      </SpaceBetween>
                    </Container>
                  ))}
                </SpaceBetween>
              )
            }
            {embeddings && (
              <Container
                header={<Header variant="h2">Results</Header>}
              ></Container>
            )}
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
