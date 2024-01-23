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
import BaseAppLayout from "../../../components/base-app-layout";
import useOnFollow from "../../../common/hooks/use-on-follow";
import CreateWorkspaceOpenSearch from "./create-workspace-opensearch";
import CreateWorkspaceAurora from "./create-workspace-aurora";
import CreateWorkspaceKendra from "./create-workspace-kendra";
import SelectEnginePanel from "./select-engine-panel";
import { CHATBOT_NAME } from "../../../common/constants";
import { Utils } from "../../../common/utils";
import { UserContext } from "../../../common/user-context";
import { UserRole } from "../../../common/types";
import { useNavigate } from "react-router-dom";

export default function CreateWorkspace() {
  const onFollow = useOnFollow();
  const navigate = useNavigate()
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const [engine, setEngine] = useState("");
  const [loading, setLoading] = useState(true);
  const [engines, setEngines] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (
      ![
        UserRole.ADMIN,
        UserRole.WORKSPACES_MANAGER
      ].includes(userContext.userRole)
    ) {
      navigate("/");
    }
  }, [userContext, navigate]);

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.ragEngines.getRagEngines();

        const engineMap = new Map<string, boolean>();

        result.data!.listRagEngines.forEach((engine) => {
          engineMap.set(engine.id, engine.enabled);
        });

        if (result.data!.listRagEngines.length > 0) {
          if (engineMap.get("aurora") === true) {
            setEngine("aurora");
          } else if (engineMap.get("opensearch") === true) {
            setEngine("opensearch");
          } else if (engineMap.get("kendra") === true) {
            setEngine("kendra");
          }
        }

        setEngines(engineMap);
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
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
