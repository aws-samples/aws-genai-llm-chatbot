import { Dispatch, SetStateAction } from "react";
import {
  ChatBotAction,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatInputState,
} from "./types";

export function updateMessageHistory(
  sessionId: string,
  messageHistory: ChatBotHistoryItem[],
  setMessageHistory: Dispatch<SetStateAction<ChatBotHistoryItem[]>>,
  response: ChatBotMessageResponse,
  setState: Dispatch<SetStateAction<ChatInputState>>
) {
  if (response.data?.sessionId !== sessionId) return;

  if (
    response.action === ChatBotAction.FinalResponse ||
    response.action === ChatBotAction.Error
  ) {
    setState((state) => ({ ...state, running: false }));
  }
  if (
    response.action === ChatBotAction.LLMNewToken ||
    response.action === ChatBotAction.FinalResponse ||
    response.action === ChatBotAction.Error
  ) {
    const content = response.data?.content;
    let metadata = response.data?.metadata;
    const token = response.data?.token;
    const hasContent = typeof content !== "undefined";
    const hasToken = typeof token !== "undefined";
    const hasMetadata = typeof metadata !== "undefined";

    if (
      messageHistory.length > 0 &&
      messageHistory[messageHistory.length - 1]["type"] !==
        ChatBotMessageType.Human
    ) {
      const lastMessage = messageHistory[messageHistory.length - 1];
      lastMessage.tokens = lastMessage.tokens || [];
      if (hasToken) {
        lastMessage.tokens.push(token);
      }

      lastMessage.tokens.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      if (lastMessage.tokens.length > 0) {
        const lastRunId =
          lastMessage.tokens[lastMessage.tokens.length - 1].runId;
        if (lastRunId) {
          lastMessage.tokens = lastMessage.tokens.filter(
            (c) => c.runId === lastRunId
          );
        }
      }

      if (!hasMetadata) {
        metadata = lastMessage.metadata;
      }

      if (hasContent) {
        setMessageHistory((history) => [
          ...history.slice(0, history.length - 1),
          {
            ...lastMessage,
            type: ChatBotMessageType.AI,
            content,
            metadata,
            tokens: lastMessage.tokens,
          },
        ]);
      } else {
        const contentFromTokens = lastMessage.tokens
          .map((c) => c.value)
          .join("");

        setMessageHistory((history) => [
          ...history.slice(0, history.length - 1),
          {
            ...lastMessage,
            type: ChatBotMessageType.AI,
            content: contentFromTokens,
            metadata,
            tokens: lastMessage.tokens,
          },
        ]);
      }
    } else {
      if (hasContent) {
        const tokens = hasToken ? [token] : [];
        setMessageHistory((history) => [
          ...history,
          {
            type: ChatBotMessageType.AI,
            content,
            metadata,
            tokens,
          },
        ]);
      } else if (typeof token !== "undefined") {
        setMessageHistory((history) => [
          ...history,
          {
            type: ChatBotMessageType.AI,
            content: token.value,
            metadata,
            tokens: [token],
          },
        ]);
      }
    }
  }
}
