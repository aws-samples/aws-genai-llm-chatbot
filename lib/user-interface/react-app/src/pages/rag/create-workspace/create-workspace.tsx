import { useContext, useEffect, useState } from "react";
import {
  ContentLayout,
  BreadcrumbGroup,
  StatusIndicator,
  SpaceBetween,
} from "@cloudscape-design/components";
import { CreateWorkspaceHeader } from "./create-workspace-header";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { ResultValue } from "../../../common/types";
import BaseAppLayout from "../../../components/base-app-layout";
import useOnFollow from "../../../common/hooks/use-on-follow";
import CreateWorkspaceOpenSearch from "./create-workspace-opensearch";
import CreateWorkspaceAurora from "./create-workspace-aurora";
import CreateWorkspaceKendra from "./create-workspace-kendra";
import SelectEnginePanel from "./select-engine-panel";
import { CHATBOT_NAME } from "../../../common/constants";

export default function CreateWorkspace() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [engine, setEngine] = useState("");
  const [loading, setLoading] = useState(true);
  const [engines, setEngines] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.ragEngines.getRagEngines();

      const engineMap = new Map<string, boolean>();

      if (ResultValue.ok(result)) {
        result.data.forEach((engine) => {
          engineMap.set(engine.id, engine.enabled);
        });

        if (result.data.length > 0) {
          if (engineMap.get("aurora") === true) {
            setEngine("aurora");
          } else if (engineMap.get("opensearch") === true) {
            setEngine("opensearch");
          } else if (engineMap.get("kendra") === true) {
            setEngine("kendra");
          }
        }

        setEngines(engineMap);
      }

      setLoading(false);
    })();
  }, [appContext]);

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
              text: "Workspaces",
              href: "/rag/workspaces",
            },
            {
              text: "Create Workspace",
              href: "/rag/workspaces/create",
            },
          ]}
          expandAriaLabel="Show path"
          ariaLabel="Breadcrumbs"
        />
      }
      content={
        <ContentLayout header={<CreateWorkspaceHeader />}>
          <SpaceBetween size="l">
            <SelectEnginePanel
              engines={engines}
              engine={engine}
              setEngine={setEngine}
            />
            {loading && (
              <StatusIndicator type="loading">Loading</StatusIndicator>
            )}
            {engine === "aurora" && <CreateWorkspaceAurora />}
            {engine === "opensearch" && <CreateWorkspaceOpenSearch />}
            {engine === "kendra" && <CreateWorkspaceKendra />}
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
