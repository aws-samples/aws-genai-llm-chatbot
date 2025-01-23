import useOnFollow from "../common/hooks/use-on-follow";
import {
  Alert,
  BreadcrumbGroup,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import { CHATBOT_NAME } from "../common/constants";
import { useContext } from "react";
import { UserContext } from "../common/user-context";
import { UserRole } from "../common/types";
import styles from "../styles/chat.module.scss";

export default function NotFound() {
  const onFollow = useOnFollow();
  const userContext = useContext(UserContext);
  return (
    <>
      {userContext.userRoles.length === 0 ? (
        <div className={styles.appChatContainer}>
          <ContentLayout
            header={<Header variant="h1">404. Page Not Found</Header>}
          >
            <SpaceBetween size="l">
              <Container>
                <Alert type="error" header="404. Page Not Found">
                  No role is assigned to your user. Please contact an
                  administrator.
                </Alert>
              </Container>
            </SpaceBetween>
          </ContentLayout>
        </div>
      ) : userContext.userRoles.includes(UserRole.ADMIN) ||
        userContext.userRoles.includes(UserRole.WORKSPACE_MANAGER) ? (
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
                  text: "Not Found",
                  href: "/not-found",
                },
              ]}
              expandAriaLabel="Show path"
              ariaLabel="Breadcrumbs"
            />
          }
          content={
            <ContentLayout
              header={<Header variant="h1">404. Page Not Found</Header>}
            >
              <SpaceBetween size="l">
                <Container>
                  <Alert type="error" header="404. Page Not Found">
                    The page you are looking for does not exist.
                  </Alert>
                </Container>
              </SpaceBetween>
            </ContentLayout>
          }
        />
      ) : (
        <div className={styles.appChatContainer}>
          <ContentLayout
            header={<Header variant="h1">404. Page Not Found</Header>}
          >
            <SpaceBetween size="l">
              <Container>
                <Alert type="error" header="404. Page Not Found">
                  The page you are looking for does not exist.
                </Alert>
              </Container>
            </SpaceBetween>
          </ContentLayout>
        </div>
      )}
    </>
  );
}
