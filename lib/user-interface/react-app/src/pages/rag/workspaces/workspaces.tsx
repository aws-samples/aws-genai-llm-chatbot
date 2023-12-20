import { BreadcrumbGroup } from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import WorkspacesTable from "./workspaces-table";
import BaseAppLayout from "../../../components/base-app-layout";
import { CHATBOT_NAME } from "../../../common/constants";
import { UserContext } from "../../../common/user-context";
import { useNavigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { UserRole } from "../../../common/types";

export default function Workspaces() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const userContext = useContext(UserContext);
  useEffect(() => {
    if (
      ![
        UserRole.ADMIN,
        UserRole.WORKSPACES_MANAGER,
        UserRole.WORKSPACES_USER,
      ].includes(userContext.userRole)
    ) {
      navigate("/");
    }
  }, [userContext, navigate]);
  return (
    <BaseAppLayout
      contentType="table"
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
          ]}
        />
      }
      content={<WorkspacesTable />}
    />
  );
}
