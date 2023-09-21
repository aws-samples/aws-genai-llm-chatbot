import { Header, SpaceBetween } from "@cloudscape-design/components";
import RouterButton from "../../../components/wrappers/router-button";
import RouterButtonDropdown from "../../../components/wrappers/router-button-dropdown";

export default function DashboardHeader() {
  return (
    <Header
      variant="h1"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <RouterButton href="/rag/semantic-search">
            Semantic search
          </RouterButton>
          <RouterButtonDropdown
            items={[
              {
                id: "upload-file",
                text: "Upload files",
                href: "/rag/workspaces/add-data?tab=file",
              },
              {
                id: "add-text",
                text: "Add texts",
                href: "/rag/workspaces/add-data?tab=text",
              },
              {
                id: "add-qna",
                text: "Add Q&A",
                href: "/rag/workspaces/add-data?tab=qna",
              },
              {
                id: "crawl-website",
                text: "Crawl website",
                href: "/rag/workspaces/add-data?tab=website",
              },
            ]}
          >
            Add data
          </RouterButtonDropdown>
        </SpaceBetween>
      }
    >
      Dashboard
    </Header>
  );
}
