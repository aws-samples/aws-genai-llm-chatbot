import {
  ExpandableSection,
  Button,
  Popover,
  StatusIndicator,
  Tabs,
  Textarea,
} from "@cloudscape-design/components";
import { JsonView, darkStyles } from "react-json-view-lite";
import { RagDocument } from "./types";
import styles from "../../styles/chat.module.scss";

interface ChatMessageMetadataSectionProps {
  metadata: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  showMetadata: boolean;
  documentIndex: string;
  promptIndex: string;
  setDocumentIndex: (index: string) => void;
  setPromptIndex: (index: string) => void;
}

export function ChatMessageMetadata({
  metadata,
  showMetadata,
  documentIndex,
  promptIndex,
  setDocumentIndex,
  setPromptIndex,
}: ChatMessageMetadataSectionProps) {
  if (!showMetadata) return null;

  return (
    <ExpandableSection variant="footer" headerText="Metadata">
      <JsonView
        shouldInitiallyExpand={(level) => level < 2}
        data={JSON.parse(JSON.stringify(metadata).replace(/\\n/g, "\\\\n"))}
        style={{
          ...darkStyles,
          stringValue: "jsonStrings",
          numberValue: "jsonNumbers",
          booleanValue: "jsonBool",
          nullValue: "jsonNull",
          container: "jsonContainer",
        }}
      />
      {metadata.documents && metadata.documents.length > 0 && (
        <>
          <div className={styles.btn_chabot_metadata_copy}>
            <Popover
              size="medium"
              position="top"
              triggerType="custom"
              dismissButton={false}
              content={
                <StatusIndicator type="success">
                  Copied to clipboard
                </StatusIndicator>
              }
            >
              <Button
                variant="inline-icon"
                iconName="copy"
                onClick={() => {
                  navigator.clipboard.writeText(
                    (metadata.documents as RagDocument[])[
                      parseInt(documentIndex)
                    ].page_content
                  );
                }}
              />
            </Popover>
          </div>
          <Tabs
            tabs={(metadata.documents as RagDocument[]).map(
              (p: RagDocument, i) => ({
                id: `${i}`,
                label:
                  p.metadata.path?.split("/").at(-1) ??
                  p.metadata.title ??
                  p.metadata.document_id.slice(-8),
                href: p.metadata.path,
                content: (
                  <Textarea
                    key={p.metadata.chunk_id}
                    value={p.page_content}
                    readOnly={true}
                    rows={8}
                  />
                ),
              })
            )}
            activeTabId={documentIndex}
            onChange={({ detail }) => setDocumentIndex(detail.activeTabId)}
          />
        </>
      )}
      {metadata.prompts && (
        <>
          <div className={styles.btn_chabot_metadata_copy}>
            <Popover
              size="medium"
              position="top"
              triggerType="custom"
              dismissButton={false}
              content={
                <StatusIndicator type="success">
                  Copied to clipboard
                </StatusIndicator>
              }
            >
              <Button
                variant="inline-icon"
                iconName="copy"
                onClick={() => {
                  navigator.clipboard.writeText(
                    (metadata.prompts as string[][])[parseInt(promptIndex)][0]
                  );
                }}
              />
            </Popover>
          </div>
          <Tabs
            tabs={(metadata.prompts as string[][]).map((p, i) => ({
              id: `${i}`,
              label: `Prompt ${metadata.prompts.length > 1 ? i + 1 : ""}`,
              content: <Textarea value={p[0]} readOnly={true} rows={8} />,
            }))}
            activeTabId={promptIndex}
            onChange={({ detail }) => setPromptIndex(detail.activeTabId)}
          />
        </>
      )}
    </ExpandableSection>
  );
}
