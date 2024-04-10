import {
  BreadcrumbGroup,
  Header,
  HelpPanel,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import WorkspacesTable from "./workspaces-table";
import BaseAppLayout from "../../../components/base-app-layout";
import { CHATBOT_NAME } from "../../../common/constants";
import { Link } from "react-router-dom";

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
      info={
        <HelpPanel header={<Header variant="h3">RAG Workspaces</Header>}>
          <p>
            RAG workspaces are built on top of a{" "}
            <Link to="/rag/engines">RAG Engine</Link>.
          </p>
          <p>
            {" "}
            RAG engines can be modified at deployment time by running{" "}
            <code
              style={{
                background: "#EEE",
                padding: "3px",
                fontSize: "1em",
                borderRadius: "5px",
              }}
            >
              npm&nbsp;run&nbsp;config
            </code>
            .
          </p>
        </HelpPanel>
      }
    />
  );
}
