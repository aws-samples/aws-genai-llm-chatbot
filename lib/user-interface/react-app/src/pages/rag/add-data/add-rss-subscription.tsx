import {
  Button,
  Container,
  Flashbar,
  FlashbarProps,
  Form,
  FormField,
  Input,
  SpaceBetween,
  Toggle,
  Multiselect,
} from "@cloudscape-design/components";
import { AddDataData, SelectOption, multiselectOptions } from "./types";
import { generateSelectedOptions } from "./utils";
import { useForm } from "../../../common/hooks/use-form";
import { useContext, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { useNavigate } from "react-router-dom";
import { Utils } from "../../../common/utils";
import { ApiClient } from "../../../common/api-client/api-client";
import { Workspace } from "../../../API";

export interface AddRssSubscriptionProps {
  data: AddDataData;
  validate: () => boolean;
  selectedWorkspace?: Workspace;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}

interface AddRssSubscriptionData {
  rssFeedUrl: string;
  rssFeedTitle: string;
  linkLimit: number;
  followLinks: boolean;
  contentTypes: (string | undefined)[];
}

export default function AddRssSubscription(props: AddRssSubscriptionProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [flashbarItem, setFlashbarItem] =
    useState<FlashbarProps.MessageDefinition | null>(null);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const { data, onChange, errors, validate } = useForm<AddRssSubscriptionData>({
    initialValue: () => {
      return {
        rssFeedUrl: "",
        rssFeedTitle: "",
        linkLimit: 250,
        followLinks: true,
        contentTypes: ["text/html"],
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (form.rssFeedUrl.length === 0) {
        errors.rssFeedUrl = "Website address is required";
      } else if (Utils.isValidURL(form.rssFeedUrl) === false) {
        errors.rssFeedUrl = "Website address is not valid.";
      }

      if (form.linkLimit < 1 || form.linkLimit > 1000) {
        errors.limit = "Page limit should be between 1 and 1000";
      }

      return errors;
    },
  });

  const onSubmit = async () => {
    if (!appContext) return;
    let validationResult = validate();
    validationResult = props.validate() && validationResult;
    if (!validationResult) return;
    if (!props.data.workspace?.value) return;

    props.setSubmitting(true);
    setFlashbarItem(null);
    setGlobalError(undefined);

    const apiClient = new ApiClient(appContext);
    const contentTypesToUse = data.contentTypes.filter(
      (ct): ct is string => ct !== undefined
    );
    try {
      await apiClient.documents.addRssFeedSubscription(
        props.data.workspace.value,
        data.rssFeedUrl,
        data.rssFeedTitle,
        data.linkLimit,
        data.followLinks,
        contentTypesToUse
      );

      setFlashbarItem({
        type: "success",
        content: "RSS Feed subscribed successfully",
        dismissible: true,
        onDismiss: () => setFlashbarItem(null),
        buttonText: "View RSS Feed Subscriptions",
        onButtonClick: () => {
          navigate(
            `/rag/workspaces/${props.data.workspace?.value}?tab=rssfeed`
          );
        },
      });

      onChange({ rssFeedUrl: "" }, true);
      onChange({ rssFeedTitle: "" }, true);
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (error: any) {
      console.error(Utils.getErrorMessage(error));
      setGlobalError(Utils.getErrorMessage(error));
    }

    props.setSubmitting(false);
  };

  const handleContentTypeChange = (
    selectedOptions: ReadonlyArray<SelectOption>
  ) => {
    const options: SelectOption[] = selectedOptions.map((option) => {
      if (option.value === undefined) {
        throw new Error(`Option value cannot be undefined`);
      }
      return {
        label: option.label,
        value: option.value,
        description: option.description,
      };
    });
    onChange({ contentTypes: options.map((option) => option.value) });
  };

  const hasReadyWorkspace =
    typeof props.data.workspace?.value !== "undefined" &&
    typeof props.selectedWorkspace !== "undefined" &&
    props.selectedWorkspace.status === "ready";

  return (
    <Form
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            data-testid="create"
            variant="primary"
            onClick={onSubmit}
            disabled={props.submitting || !hasReadyWorkspace}
          >
            Subscribe to RSS Feed
          </Button>
        </SpaceBetween>
      }
      errorText={globalError}
    >
      <SpaceBetween size="l">
        <Container>
          <SpaceBetween size="l">
            <FormField
              label="RSS Feed URL"
              errorText={errors.rssFeedUrl}
              description="Address should start with http:// or https://"
            >
              <Input
                placeholder="https://example.com/rss"
                disabled={props.submitting}
                type="url"
                value={data.rssFeedUrl}
                onChange={({ detail: { value } }) =>
                  onChange({ rssFeedUrl: value })
                }
              />
            </FormField>
            <FormField
              label="RSS Feed Title"
              description="Give your feed a title to recognize it in the future"
            >
              <Input
                placeholder="Cool RSS Feed"
                disabled={props.submitting}
                type="text"
                value={data.rssFeedTitle}
                onChange={({ detail: { value } }) =>
                  onChange({ rssFeedTitle: value })
                }
              />
            </FormField>
            <FormField
              label="Follow Links"
              description="Follow links on the website to crawl more pages"
              errorText={errors.followLinks}
            >
              <Toggle
                disabled={props.submitting}
                checked={data.followLinks}
                onChange={({ detail: { checked } }) =>
                  onChange({ followLinks: checked })
                }
              >
                Follow
              </Toggle>
            </FormField>
            <FormField
              label="Page Limit"
              errorText={errors.limit}
              description="Maximum number of pages to crawl for each post in the RSS Feed"
            >
              <Input
                type="number"
                disabled={props.submitting || !data.followLinks}
                value={data.linkLimit.toString()}
                onChange={({ detail: { value } }) =>
                  onChange({ linkLimit: parseInt(value) })
                }
              />
            </FormField>
            <FormField
              label="Enabled Content Types"
              errorText={errors.contentTypes}
              description="Content Types to Enable for crawlingl"
            >
              <Multiselect
                disabled={props.submitting}
                selectedOptions={generateSelectedOptions(data.contentTypes)}
                options={multiselectOptions}
                onChange={({ detail }) =>
                  handleContentTypeChange(detail.selectedOptions)
                }
              />
            </FormField>
          </SpaceBetween>
        </Container>
        {flashbarItem !== null && <Flashbar items={[flashbarItem]} />}
      </SpaceBetween>
    </Form>
  );
}
