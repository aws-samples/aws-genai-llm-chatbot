import {
  BreadcrumbGroup,
  Cards,
  StatusIndicator,
  Header,
  Alert,
} from "@cloudscape-design/components";
import { EnginesPageHeader } from "./engines-page-header";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { useContext, useEffect, useState } from "react";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { CHATBOT_NAME } from "../../../common/constants";
import { RagEngine } from "../../../API";
import { Utils } from "../../../common/utils";

const CARD_DEFINITIONS = {
  header: (item: RagEngine) => (
    <div>
      <Header>{item.name}</Header>
    </div>
  ),
  sections: [
    {
      id: "id",
      header: "id",
      content: (item: RagEngine) => item.id,
    },
    {
      id: "state",
      header: "State",
      content: (item: RagEngine) => (
        <StatusIndicator type={item.enabled ? "success" : "stopped"}>
          {item.enabled ? "Enabled" : "Disabled"}
        </StatusIndicator>
      ),
    },
  ],
};

export default function Engines() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [data, setData] = useState<RagEngine[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        setGlobalError(undefined);
        const result = await apiClient.ragEngines.getRagEngines();

        /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
        setData(result.data?.listRagEngines!);
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setGlobalError(Utils.getErrorMessage(error));
      }

      setLoading(false);
    })();
  }, [appContext]);

  return (
    <BaseAppLayout
      contentType="cards"
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
              text: "Engines",
              href: "/rag/engines",
            },
          ]}
        />
      }
      content={
        <>
          {globalError && (
            <Alert
              statusIconAriaLabel="Error"
              type="error"
              header="Unable to load the engines."
            >
              {globalError}
            </Alert>
          )}
          <Cards
            stickyHeader={true}
            cardDefinition={CARD_DEFINITIONS}
            loading={loading}
            loadingText="Loading engines"
            items={data || []}
            variant="full-page"
            header={<EnginesPageHeader />}
          />
        </>
      }
    />
  );
}
