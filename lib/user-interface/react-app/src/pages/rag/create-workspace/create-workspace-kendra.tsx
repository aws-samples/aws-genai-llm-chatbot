import { SpaceBetween, Button, Form } from "@cloudscape-design/components";
import { useState } from "react";
import RouterButton from "../../../components/wrappers/router-button";

export default function CreateWorkspaceKendra() {
  const [errorText] = useState<string | undefined>(undefined);

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <RouterButton variant="link" href="/rag">
              Cancel
            </RouterButton>
            <Button data-testid="create" variant="primary">
              Create Workspace
            </Button>
          </SpaceBetween>
        }
        errorText={errorText}
      ></Form>
    </form>
  );
}
