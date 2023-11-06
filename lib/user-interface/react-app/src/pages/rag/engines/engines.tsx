import {
  BreadcrumbGroup,
  Cards,
  StatusIndicator,
  Header,
} from "@cloudscape-design/components";
import { EnginesPageHeader } from "./engines-page-header";
import { EngineItem, ResultValue } from "../../../common/types";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { useContext, useEffect, useState } from "react";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { CHATBOT_NAME } from "../../../common/constants";

const CARD_DEFINITIONS = {
  header: (item: EngineItem) => (
    <div>
      <Header>{item.name}</Header>
    </div>
  ),
  sections: [
    {
      id: "id",
      header: "id",
      content: (item: EngineItem) => item.id,
    },
    {
      id: "state",
      header: "State",
      content: (item: EngineItem) => (
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
  const [data, setData] = useState<EngineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.ragEngines.getRagEngines();

      if (ResultValue.ok(result)) {
        setData(result.data);
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
        <Cards
          stickyHeader={true}
          cardDefinition={CARD_DEFINITIONS}
          loading={loading}
          loadingText="Loading engines"
          items={data || []}
          variant="full-page"
          header={<EnginesPageHeader />}
        />
      }
    />
  );
}
