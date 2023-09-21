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
} from "@cloudscape-design/components";
import { AddDataData } from "./types";
import { useForm } from "../../../common/hooks/use-form";
import { useContext, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { useNavigate } from "react-router-dom";
import { Utils } from "../../../common/utils";
import { ResultValue, WorkspaceItem } from "../../../common/types";
import { ApiClient } from "../../../common/api-client/api-client";

export interface CrawlWebsiteProps {
  data: AddDataData;
  validate: () => boolean;
  selectedWorkspace?: WorkspaceItem;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}

interface CrawlWebisteData {
  urlType: "website" | "sitemap" | string;
  websiteUrl: string;
  sitemapUrl: string;
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
    const result = await apiClient.documents.addWebsiteDocument(
      props.data.workspace.value,
      isSitemap,
      isSitemap ? data.sitemapUrl : data.websiteUrl
    );

    if (ResultValue.ok(result)) {
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
    } else {
      setGlobalError(Utils.getErrorMessage(result));
    }

    props.setSubmitting(false);
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
          </SpaceBetween>
        </Container>
        {flashbarItem !== null && <Flashbar items={[flashbarItem]} />}
      </SpaceBetween>
    </Form>
  );
}
