import { Header } from "@cloudscape-design/components";

export function CreateWorkspaceHeader() {
  return (
    <Header
      variant="h1"
      description="A workspace is a logical namespace where you can upload files for indexing and storage in one of the vector databases. You can select the embeddings model and text-splitting configuration of your choice."
    >
      Create Workspace
    </Header>
  );
}
