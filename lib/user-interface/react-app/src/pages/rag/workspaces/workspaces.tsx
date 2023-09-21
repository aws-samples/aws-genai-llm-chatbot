import { BreadcrumbGroup } from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import WorkspacesTable from "./workspaces-table";
import BaseAppLayout from "../../../components/base-app-layout";

export default function Workspaces() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      contentType="table"
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
              text: "Workspaces",
              href: "/rag/workspaces",
            },
          ]}
        />
      }
      content={<WorkspacesTable />}
    />
  );
}
