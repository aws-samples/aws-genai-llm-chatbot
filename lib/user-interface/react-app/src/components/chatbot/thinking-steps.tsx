import { Box, TextContent } from "@cloudscape-design/components";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../../styles/thinking-steps.module.scss";

interface ThinkingStepsProps {
  steps: string[];
  isThinking?: boolean;
}

export function ThinkingSteps({ steps, isThinking }: ThinkingStepsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) {
    return null;
  }

  const headerText = isThinking
    ? "Thinking..."
    : `Thought process (${steps.length} steps)`;
  const currentStep =
    isThinking && steps.length > 0 ? steps[steps.length - 1] : null;

  return (
    <Box margin={{ bottom: "s" }} className={styles.thinking_container}>
      <div
        className={styles.thinking_header}
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
      >
        <span className={styles.expand_icon}>{expanded ? "▼" : "▶"}</span>
        {headerText}
      </div>
      {isThinking && currentStep && (
        <div className={styles.current_step}>
          <TextContent>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children }) => (
                  <pre style={{ whiteSpace: "pre-wrap" }}>{children}</pre>
                ),
              }}
            >
              {currentStep}
            </ReactMarkdown>
          </TextContent>
        </div>
      )}
      {expanded && (
        <Box padding={{ vertical: "xs", left: "s" }}>
          {steps.map((step, index) => (
            <div key={index} className={styles.thinking_step_container}>
              <div className={styles.step_content}>
                <TextContent>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ children }) => (
                        <pre style={{ whiteSpace: "pre-wrap" }}>{children}</pre>
                      ),
                    }}
                  >
                    {step}
                  </ReactMarkdown>
                </TextContent>
              </div>
            </div>
          ))}
        </Box>
      )}
    </Box>
  );
}
