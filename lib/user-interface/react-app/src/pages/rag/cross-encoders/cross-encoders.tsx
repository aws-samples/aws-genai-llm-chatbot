import {
  BreadcrumbGroup,
  Button,
  Container,
  ContentLayout,
  Form,
  FormField,
  Header,
  HelpPanel,
  Link,
  Select,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  Textarea,
} from "@cloudscape-design/components";
import BaseAppLayout from "../../../components/base-app-layout";
import useOnFollow from "../../../common/hooks/use-on-follow";
import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { useForm } from "../../../common/hooks/use-form";
import { LoadingStatus } from "../../../common/types";
import { ApiClient } from "../../../common/api-client/api-client";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { Utils } from "../../../common/utils";
import { CHATBOT_NAME } from "../../../common/constants";
import { CrossEncoderData } from "../../../API";

export default function CrossEncoders() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [crossEncoderModelsStatus, setCrossEncoderModelsStatus] =
    useState<LoadingStatus>("loading");
  const [crossEncoderModels, setCrossEncoderModels] = useState<
    CrossEncoderData[]
  >([]);
  const [ranking, setRanking] = useState<
    | {
        index: number;
        passage: string;
        score: number;
      }[]
    | null
  >(null);

  const { data, onChange, errors, validate } = useForm({
    initialValue: () => {
      const retValue: {
        crossEncoderModel: SelectProps.Option | null;
        input: string;
        passages: string[];
      } = {
        crossEncoderModel: OptionsHelper.getSelectOption(
          appContext?.config.default_cross_encoder_model
        ),
        input: "",
        passages: [""],
      };

      return retValue;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (!form.crossEncoderModel) {
        errors.crossEncoderModel = "Cross-encoder model is required";
      }

      if (!form.input || form.input.trim().length === 0) {
        errors.input = "Input is required";
      } else if (form.input.trim().length > 10000) {
        errors.input = "Max input length is 10000 characters";
      }

      for (let i = 0; i < form.passages.length; i++) {
        const passage = form.passages[i];
        if (passage.trim().length === 0) {
          errors.passages = errors.passages || [];
          if (Array.isArray(errors.passages)) {
            errors.passages[i] = "Passage is required";
          }
        }

        if (passage.trim().length > 10000) {
          errors.passages = errors.passages || [];
          if (Array.isArray(errors.passages)) {
            errors.passages[i] = "Max passage length is 10000 characters";
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
      try {
        const result = await apiClient.crossEncoders.getModels();

        console.log(result?.data?.listCrossEncoders);
        /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
        setCrossEncoderModels(result?.data?.listCrossEncoders!);
        setCrossEncoderModelsStatus("finished");
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setGlobalError(Utils.getErrorMessage(error));
        setCrossEncoderModelsStatus("error");
      }
    })();
  }, [appContext]);

  const addPassage = () => {
    const newPassages = [...data.passages];
    newPassages.push("");
    onChange({ passages: newPassages });
  };

  const removePassage = (index: number) => {
    const newPassages = [...data.passages];
    newPassages.splice(index, 1);
    onChange({ passages: newPassages });
  };

  const onLoadSampleData = () => {
    onChange({
      input: "What is the capital of France?",
      passages: [
        "The Eiffel Tower is in Paris. The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. Constructed from 1887, it is named after the engineer Gustave Eiffel, whose company designed and built the tower.",
        "The Louvre, or the Louvre Museum, is a national art museum in Paris, France. A central landmark of the city, it is located on the Right Bank of the Seine in the city's 1st arrondissement and home to some of the most canonical works of Western art, including the Mona Lisa and the Venus de Milo.",
        'Paris, often referred to as "The City of Light" is renowned for its rich history, iconic landmarks like the Eiffel Tower, and contributions to art, fashion, and cuisine. The city serves as a cultural hub that attracts millions of tourists each year, offering world-class museums, romantic cobblestone streets, and a vibrant atmosphere that has inspired artists and writers for centuries.',
        'Paris is the capital of France. Situated on the Seine River, in the north of the country, it is in the centre of the Île-de-France region, also known as the region parisienne, "Paris Region".',
        "Brussels is the capital of Belgium. Belgium has borders with France, the Netherlands, and Luxembourg.",
      ],
    });
  };

  const submitForm = async () => {
    if (!validate()) return;
    if (!appContext) return;

    setGlobalError(undefined);
    setSubmitting(true);
    setRanking(null);

    const { provider, name } = OptionsHelper.parseValue(
      data.crossEncoderModel?.value
    );

    const apiClient = new ApiClient(appContext);
    const result = await apiClient.crossEncoders.getRanking(
      provider,
      name,
      data.input.trim(),
      data.passages.map((p) => p.trim())
    );

    console.log(result);
    if (result.errors === undefined) {
      const passages = result
        .data!.rankPassages!.map((rank, index) => ({
          index,
          passage: rank.passage,
          score: rank.score,
        }))
        .sort((a, b) => b.score - a.score);

      setRanking(passages);
    } else {
      setGlobalError(result.errors.map((x) => x.message).join(","));
    }

    setSubmitting(false);
  };

  const crossEncoderModelOptions =
    OptionsHelper.getSelectOptionGroups(crossEncoderModels);

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
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "RAG",
              href: "/rag",
            },
            {
              text: "Cross-Encoders",
              href: "/rag/cross-encoders",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Cross-Encoder models employ a classification approach for data pairs rather than generating vector embeddings for the data."
            >
              Cross-Encoders (Re-ranking)
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
                    data-locator="submit"
                    disabled={submitting}
                    variant="primary"
                    onClick={submitForm}
                  >
                    Rank passages
                  </Button>
                </SpaceBetween>
              }
              errorText={globalError}
            >
              <SpaceBetween size="l">
                <Container header={<Header variant="h1">Model</Header>}>
                  <SpaceBetween size="l">
                    <FormField
                      label="Cross-Encoder Model"
                      errorText={errors.crossEncoderModel}
                    >
                      <Select
                        data-locator="select-model"
                        disabled={submitting}
                        selectedAriaLabel="Selected"
                        placeholder="Choose a cross-encoder model"
                        statusType={crossEncoderModelsStatus}
                        loadingText="Loading cross-encoder models (might take few seconds)..."
                        selectedOption={data.crossEncoderModel}
                        options={crossEncoderModelOptions}
                        onChange={({ detail: { selectedOption } }) =>
                          onChange({ crossEncoderModel: selectedOption })
                        }
                        empty={<div>No cross-encoder models found</div>}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
                <Container header={<Header variant="h1">Input</Header>}>
                  <SpaceBetween size="l">
                    <FormField
                      label="Query text"
                      errorText={errors.input}
                      info={
                        <Link onFollow={onLoadSampleData}>
                          load sample data
                        </Link>
                      }
                    >
                      <Textarea
                        disabled={submitting}
                        data-locator="query"
                        value={data.input}
                        onChange={({ detail }) => {
                          onChange({ input: detail.value });
                        }}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
                <Container header={<Header variant="h1">Passages</Header>}>
                  <SpaceBetween size="l">
                    {data.passages.map((passage, index) => (
                      <FormField
                        key={index}
                        label={`Passage ${index + 1}`}
                        errorText={errors.passages?.[index]}
                        secondaryControl={
                          <Button
                            disabled={submitting || index === 0}
                            onClick={() => removePassage(index)}
                          >
                            Remove
                          </Button>
                        }
                      >
                        <Textarea
                          disabled={submitting}
                          value={passage}
                          data-locator={`passage-${index}`}
                          onChange={({ detail }) => {
                            const newPassages = [...data.passages];
                            newPassages[index] = detail.value;
                            onChange({ passages: newPassages });
                          }}
                        />
                      </FormField>
                    ))}
                    <Button
                      disabled={submitting || data.passages.length >= 5}
                      data-locator="add-passage"
                      onClick={addPassage}
                    >
                      Add new passage
                    </Button>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            </Form>
            {ranking && (
              <Container
                header={
                  <Header variant="h1">
                    Results&nbsp;(
                    {ranking.map((val, index) => (
                      <React.Fragment key={index}>
                        {index < ranking.length - 1 ? (
                          <>{val.index + 1},&nbsp;</>
                        ) : (
                          <>{val.index + 1}</>
                        )}
                      </React.Fragment>
                    ))}
                    )
                  </Header>
                }
              >
                <SpaceBetween size="l">
                  {ranking.map((item, index) => (
                    <FormField
                      data-locator={`passage-result-${index}`}
                      key={item.index}
                      label={`Passage ${
                        item.index + 1
                      } (score: ${item.score.toFixed(4)})`}
                    >
                      <Textarea
                        data-locator={`passage-result-${index}`}
                        rows={5}
                        value={item.passage}
                        readOnly={true}
                      />
                    </FormField>
                  ))}
                </SpaceBetween>
              </Container>
            )}
          </SpaceBetween>
        </ContentLayout>
      }
      info={
        <HelpPanel header={<Header variant="h3">Cross-Encoders</Header>}>
          <p>Cross-encoders are ...</p>
        </HelpPanel>
      }
    />
  );
}
