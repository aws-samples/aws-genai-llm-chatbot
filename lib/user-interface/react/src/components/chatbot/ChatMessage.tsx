import Container from '@cloudscape-design/components/container';
import TextContent from '@cloudscape-design/components/text-content';
import ReactMarkdown from 'react-markdown';
import Spinner from '@cloudscape-design/components/spinner';
import Box from '@cloudscape-design/components/box';
import ExpandableSection from '@cloudscape-design/components/expandable-section';

import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { SpaceBetween } from '@cloudscape-design/components';

import { ChatbotMessageType } from './types';

export default function Message({ message, showMetadata }) {
  return (
    <div className="mt-2">
      {message?.type === ChatbotMessageType.Running && (
        <Container>
          <Box float="left">
            <Spinner />
          </Box>
        </Container>
      )}
      {message?.type !== ChatbotMessageType.Human && message?.type !== ChatbotMessageType.Running && (
        <Container>
          <SpaceBetween size="s" direction="vertical">
            <ReactMarkdown children={message.content} />
            {message.metadata && showMetadata && (
              <ExpandableSection variant="footer" headerText="Metadata">
                <JsonView data={message.metadata} style={darkStyles} />
              </ExpandableSection>
            )}
          </SpaceBetween>
        </Container>
      )}
      {message?.type === ChatbotMessageType.Human && (
        <TextContent>
          <strong>{message.content}</strong>
        </TextContent>
      )}
    </div>
  );
}
