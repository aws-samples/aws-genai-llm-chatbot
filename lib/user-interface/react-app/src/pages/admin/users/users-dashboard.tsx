import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
} from "@cloudscape-design/components";
import BaseAppLayout from "../../../components/base-app-layout";
import { CHATBOT_NAME } from "../../../common/constants";
import useOnFollow from "../../../common/hooks/use-on-follow";
import UsersTable from "../../../components/admin/users/users-table";

export default function UsersDashboard() {
  const onFollow = useOnFollow();
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
              text: "Admin",
              href: "#",
            },
            {
              text: "Users",
              href: "/admin/users",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Create, update and remove users from the Chatbot and RAG Workspaces."
            >
              Manage Users
            </Header>
          }
        >
          <UsersTable />
        </ContentLayout>
      }
    />
  );
}
