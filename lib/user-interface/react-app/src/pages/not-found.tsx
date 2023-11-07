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

export default function NotFound() {
  const onFollow = useOnFollow();

  return (
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
  );
}
