import { SpaceBetween } from '@cloudscape-design/components';
import { Documents } from '../components/files/Documents';
import { Header } from '@cloudscape-design/components';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Alert from '@cloudscape-design/components/alert';

import { useEffect } from 'react';

export function Files({ setTools }) {
  useEffect(() => {
    setTools(null);
  }, [setTools]);

  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header variant="h1" description="Upload documents to perform RAG on your documents">
            Files
          </Header>
        </SpaceBetween>
      }
    >
      <Documents />
    </ContentLayout>
  );
}
export default Files;
