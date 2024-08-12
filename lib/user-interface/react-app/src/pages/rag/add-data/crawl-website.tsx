import {
  Button,
  Container,
  Flashbar,
  FlashbarProps,
  Form,
  FormField,
  Input,
  SegmentedControl,
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

export interface CrawlWebsiteProps {
  data: AddDataData;
  validate: () => boolean;
  selectedWorkspace?: Workspace;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}

interface CrawlWebisteData {
  urlType: "website" | "sitemap" | string;
  websiteUrl: string;
  sitemapUrl: string;
  followLinks: boolean;
  limit: number;
  contentTypes: (string | undefined)[];
}

export default function CrawlWebsite(props: CrawlWebsiteProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [flashbarItem, setFlashbarItem] =
    useState<FlashbarProps.MessageDefinition | null>(null);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const { data, onChange, errors, validate } = useForm<CrawlWebisteData>({
    initialValue: () => {
      return {
        urlType: "website",
        websiteUrl: "",
        sitemapUrl: "",
        followLinks: true,
        limit: 250,
        contentTypes: ["text/html"],
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (form.urlType === "website") {
        if (form.websiteUrl.length === 0) {
          errors.websiteUrl = "Website address is required";
        } else if (Utils.isValidURL(form.websiteUrl) === false) {
          errors.websiteUrl = "Website address is not valid.";
        }
      }

      if (form.urlType === "sitemap") {
        if (form.sitemapUrl.length === 0) {
          errors.sitemapUrl = "Sitemap is required";
        } else if (Utils.isValidURL(form.sitemapUrl) === false) {
          errors.sitemapUrl = "Sitemap address is not valid.";
        }
      }

      if (form.limit < 1 || form.limit > 1000) {
        errors.limit = "Page limit should be between 1 and 1000";
      }

      if (form.contentTypes.length === 0) {
        errors.contentTypes = "At least one content type must be selected.";
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
    const isSitemap = data.urlType === "sitemap";
    const contentTypesToUse = data.contentTypes.filter(
      (ct): ct is string => ct !== undefined
    );
    try {
      await apiClient.documents.addWebsiteDocument(
        props.data.workspace.value,
        isSitemap,
        isSitemap ? data.sitemapUrl : data.websiteUrl,
        data.followLinks,
        data.limit,
        contentTypesToUse
      );

      setFlashbarItem({
        type: "success",
        content: "Website added successfully",
        dismissible: true,
        onDismiss: () => setFlashbarItem(null),
        buttonText: "View websites",
        onButtonClick: () => {
          navigate(
            `/rag/workspaces/${props.data.workspace?.value}?tab=website`
          );
        },
      });

      onChange({ websiteUrl: "", sitemapUrl: "" }, true);
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (error: any) {
      setGlobalError(Utils.getErrorMessage(error));
      console.error(Utils.getErrorMessage(error));
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
            Crawl website
          </Button>
        </SpaceBetween>
      }
      errorText={globalError}
    >
      <SpaceBetween size="l">
        <Container>
          <SpaceBetween size="l">
            <SegmentedControl
              selectedId={data.urlType}
              onChange={({ detail }) =>
                onChange({ urlType: detail.selectedId })
              }
              label="URL Type"
              options={[
                { id: "website", text: "Website" },
                { id: "sitemap", text: "Sitemap" },
              ]}
            />
            {data.urlType === "website" && (
              <FormField
                label="Website Address"
                errorText={errors.websiteUrl}
                description="Address should start with http:// or https://"
              >
                <Input
                  placeholder="https://example.com"
                  disabled={props.submitting}
                  type="url"
                  value={data.websiteUrl}
                  onChange={({ detail: { value } }) =>
                    onChange({ websiteUrl: value })
                  }
                />
              </FormField>
            )}
            {data.urlType === "sitemap" && (
              <FormField
                label="Sitemap"
                errorText={errors.sitemapUrl}
                description="Address should start with http:// or https://"
              >
                <Input
                  placeholder="https://example.com/sitemap.xml"
                  disabled={props.submitting}
                  type="url"
                  value={data.sitemapUrl}
                  onChange={({ detail: { value } }) =>
                    onChange({ sitemapUrl: value })
                  }
                />
              </FormField>
            )}
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
              description="Maximum number of pages to crawl"
            >
              <Input
                type="number"
                disabled={props.submitting}
                value={data.limit.toString()}
                onChange={({ detail: { value } }) =>
                  onChange({ limit: parseInt(value) })
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
