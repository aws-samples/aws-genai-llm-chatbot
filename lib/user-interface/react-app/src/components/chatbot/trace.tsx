import { useEffect, useState } from "react";
import { AgentTrace } from "./chat";

const orchestrationLabels: { [key: string]: string } = {
  input: "processing task...",
  output: "processing results...",
  rationale: "thinking what to do...",
  invocationinput: "calling the tools...",
  observation: "processing tool response",
  sdk_unknown_member: "working...",
};

const preProcessingLabels: { [key: string]: string } = {
  input: "elaborating query...",
  output: "parsing results...",
};

export function Trace({ agentTrace }: { readonly agentTrace: AgentTrace }) {
  const [progress, setProgress] = useState<AgentTrace>();
  const [text, setText] = useState("");

  useEffect(() => {
    setProgress((currentProcess) => ({ ...currentProcess, ...agentTrace }));
    if (agentTrace === undefined) {
      setProgress({});
    }
  }, [agentTrace]);

  useEffect(() => {
    console.log(progress);
    if (progress?.preProcessingTrace) {
      const t = Object.keys(progress.preProcessingTrace)[0].replace(
        "modelInvocation",
        ""
      );
      setText(`🤔 ${preProcessingLabels[t.toLowerCase()] ?? t}`);
    }
    if (progress?.orchestrationTrace) {
      const t = Object.keys(progress.orchestrationTrace)[0].replace(
        "modelInvocation",
        ""
      );
      // If the key is Invocation input we can determine if the target
      // was the KB or the ActionGroup
      setText(`🛠️ ${orchestrationLabels[t.toLowerCase()] ?? t}`);
    }
  }, [progress]);

  return <div style={{ fontSize: "0.9em" }}>{text}</div>;
}
