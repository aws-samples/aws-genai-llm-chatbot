import { SpaceBetween, Button, Form } from "@cloudscape-design/components";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Utils } from "../../../common/utils";
import { useForm } from "../../../common/hooks/use-form";
import { KendraWorkspaceCreateInput, ResultValue } from "../../../common/types";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import RouterButton from "../../../components/wrappers/router-button";
import KendraForm from "./kendra-form";

const nameRegex = /^[\w+_-]+$/;
const defaults: KendraWorkspaceCreateInput = {
  name: "",
};

export default function CreateWorkspaceKendra() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const { data, onChange, errors, validate } = useForm({
    initialValue: () => {
      const retValue = {
        ...defaults,
      };

      return retValue;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};
      const name = form.name.trim();

      if (name.trim().length === 0) {
        errors.name = "Workspace name is required";
      } else if (name.trim().length > 100) {
        errors.name = "Workspace name must be less than 100 characters";
      } else if (!nameRegex.test(name)) {
        errors.name =
          "Workspace name can only contain letters, numbers, underscores, and dashes";
      }

      return errors;
    },
  });

  const submitForm = async () => {
    if (!validate()) return;
    if (!appContext) return;

    setGlobalError(undefined);
    setSubmitting(true);

    const apiClient = new ApiClient(appContext);
    const result = await apiClient.workspaces.createKendraWorkspace({
      name: data.name.trim(),
    });

    if (ResultValue.ok(result)) {
      navigate("/rag/workspaces");
      return;
    }

    setSubmitting(false);
    setGlobalError("Something went wrong");
  };

  if (Utils.isDevelopment()) {
    console.log("re-render");
  }

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <RouterButton variant="link" href="/rag" disabled={submitting}>
              Cancel
            </RouterButton>
            <Button
              data-testid="create"
              variant="primary"
              onClick={submitForm}
              disabled={submitting}
            >
              Create Workspace
            </Button>
          </SpaceBetween>
        }
        errorText={globalError}
      >
        <KendraForm
          data={data}
          onChange={onChange}
          errors={errors}
          submitting={submitting}
        />
      </Form>
    </form>
  );
}
