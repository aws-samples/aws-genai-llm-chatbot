import {
  Alert,
  BreadcrumbGroup,
  Container,
  ContentLayout,
  ExpandableSection,
  Header,
  SpaceBetween,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import { CHATBOT_NAME } from "../common/constants";

export default function NoUserRole() {
  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "User Permission Error",
              href: "/no-user-role",
            },
          ]}
          expandAriaLabel="Show path"
          ariaLabel="Breadcrumbs"
        />
      }
      content={
        <ContentLayout
          header={<Header variant="h1">User Permission Error</Header>}
        >
          <SpaceBetween size="s">
            <Container>
              <Alert type="error">
                <SpaceBetween size="s" direction="vertical">
                  <>
                    Your user is not configured with a user role. A user role is
                    necessary to determine your appropriate access and
                    permissions.
                  </>
                  <>
                    Please contact your Chatbot admin and request your user is
                    updated with the necessary attributes.
                  </>
                </SpaceBetween>
              </Alert>
            </Container>
            <ExpandableSection headerText="Chatbot Admin Instructions">
              <SpaceBetween size="s" direction="vertical">
                <Header description="If you or your users are seeing this page, it means that the current user is missing the a custom user role attribute applied to the Cognito User. Follow the steps below to resolve this issue.">
                  Chatbot Admin Instructions to Resolve Missing User Roles
                </Header>
                <Container>
                  <ol>
                    <li>
                      Sign in to the AWS Management Console and select{" "}
                      <b>Cognito</b> under Security, Identity & Compliance or
                      search for it in the Search bar on the top of the console.
                    </li>
                    <li>
                      On the Cognito page, select the <b>user pool</b> you want
                      to manage users for.
                    </li>
                    <li>
                      On the user pool page, navigate to the <b>Users</b> tab,
                      if you aren't already viewing the tab.
                    </li>
                    <li>
                      This will show a list of all users in the pool. Find the
                      user you want to edit and click the user name
                    </li>
                    <li>
                      On the user details page, click <b>Edit</b> in the{" "}
                      <b>User attributes</b> section
                    </li>
                    <li>
                      In the <b>Optional attributes</b> section, locate the
                      attribute called <b>custom:userRole</b>.{" "}
                      <i>If you do not see the attribute</i>, click the{" "}
                      <b>Add another</b> button to add an aditional attribute
                      and locate <b>custom:userRole</b> from the list of
                      possible attributes.
                    </li>
                    <li>
                      In the <b>Value</b> field, input one of the four possible
                      user roles, depending on what permissions the user should
                      have. The roles are <b>case sensitive</b>
                      <ul>
                        <li>
                          <b>admin</b> -{" "}
                          <i>
                            Can access chatbot, manage and use RAG workspaces,
                            and administer the application, such as managing
                            users in the app
                          </i>
                        </li>
                        <li>
                          <b>workspaces_manager</b> -{" "}
                          <i>
                            Can access chatbot, manage and use RAG workspaces
                          </i>
                        </li>
                        <li>
                          <b>workspaces_user</b> -{" "}
                          <i>
                            Can access chatbot and use RAG workspaces. Cannot
                            create, edit or add data to workspaces
                          </i>
                        </li>
                        <li>
                          <b>chatbot_user</b> -{" "}
                          <i>
                            Can access only the chatbot. Users can add a RAG
                            workspace to the chat, but can't view the workspaces
                          </i>
                        </li>
                      </ul>
                    </li>
                    <li>
                      Click the <b>Save changes</b> button to complete the
                      update.
                    </li>
                    <li>
                      If the user was already logged in, they should log out.
                      Once they login, the updated user role will take effect.
                    </li>
                  </ol>
                  <i>
                    Note: Users should be created by admin users from within the
                    chatbot application. If a user is created in Cognito, the
                    user role must be applied. Creating users in the chatbot
                    application will ensure is created with the correct
                    configuration.
                  </i>
                </Container>
              </SpaceBetween>
            </ExpandableSection>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
