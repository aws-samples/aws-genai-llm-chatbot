import { useEffect, useState } from "react";
import { AgentTrace } from "./chat";

export function Trace(props: { agentTrace: AgentTrace }) {
  const [progress, setProgress] = useState<AgentTrace>();
  const preProcessingLabels: { [key: string]: string } = {
    input: "elaborating query...",
    output: "parsing results...",
  };
  const orchestrationLabels: { [key: string]: string } = {
    input: "processing task...",
    output: "processing results...",
    rationale: "thinking what to do...",
    invocationinput: "calling the tools...",
    observation: "processing tool response",
  };
  // const labels: { [key: string]: string } = {
  //   "preProcessingTrace:modelInvocationInput": "🤔 Input",
  //   "preProcessingTrace:modelInvocationOutput": "🤔 Output",
  //   "orchestrationTrace:modelInvocationInput": "⚙️ Input",
  //   "orchestrationTrace:modelInvocationOutput": "Orchestration Output",
  //   "orchestrationTrace:rationale:": "Orchestration Rationale",
  //   "orchestrationTrace:observation:actionGroupInvocationOutput":
  //     "Orchestration ActionGroup Output",
  //   "orchestrationTrace:observation:finalResponse:":
  //     "Orchestration Final Response",
  // };

  function walk(object: { [key: string]: any }) {
    let trace = "";
    Object.keys(object).forEach((key) => {
      if (typeof object[key] === "object") {
        if (!key.includes("Input") && !key.includes("Output")) {
          trace += `${key}:${walk(object[key])}`;
        } else {
          trace += `${key}`;
        }
      }
    });
    return trace;
  }

  useEffect(() => {
    const trace = walk(props.agentTrace);
    console.log(trace);
    //const traceMapped = labels[trace] ?? trace;
    setProgress({ ...progress, ...props.agentTrace });
    if (props.agentTrace === undefined) {
      setProgress({});
    }
  }, [props.agentTrace]);

  let t = "";
  if (progress?.preProcessingTrace) {
    const text = Object.keys(progress.preProcessingTrace)[0].replace(
      "modelInvocation",
      ""
    );
    t = `🤔 ${preProcessingLabels[text.toLowerCase()] ?? text}`;
  }
  if (progress?.orchestrationTrace) {
    const text = Object.keys(progress.orchestrationTrace)[0].replace(
      "modelInvocation",
      ""
    );
    // If the key is Invocation input we can determine if the target
    // was the KB or the ActionGroup
    t = `🛠️ ${orchestrationLabels[text.toLowerCase()] ?? text}`;
  }
  return <div style={{ fontSize: "1.2em" }}>{t}</div>;
}
