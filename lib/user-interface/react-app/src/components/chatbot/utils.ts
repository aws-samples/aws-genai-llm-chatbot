import { Dispatch, SetStateAction } from "react";
import {
  ChatBotAction,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotToken,
} from "./types";
import { ChatSession } from "./multi-chat";
import { SelectProps } from "@cloudscape-design/components";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { Model } from "../../API";

export function updateMessageHistory(
  sessionId: string,
  messageHistory: ChatBotHistoryItem[],
  setMessageHistory: Dispatch<SetStateAction<ChatBotHistoryItem[]>>,
  response: ChatBotMessageResponse
) {
  if (response.data?.sessionId !== sessionId) return;

  if (
    response.action === ChatBotAction.LLMNewToken ||
    response.action === ChatBotAction.FinalResponse ||
    response.action === ChatBotAction.ThinkingStep ||
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
  } else {
    console.error(`Unrecognized type ${response.action}`);
  }
}

export function updateMessageHistoryRef(
  sessionId: string,
  messageHistory: ChatBotHistoryItem[],
  response: ChatBotMessageResponse,
  messageTokens: { [key: string]: ChatBotToken[] }
) {
  if (response.data?.sessionId !== sessionId) return;

  if (
    response.action === ChatBotAction.LLMNewToken ||
    response.action === ChatBotAction.FinalResponse ||
    response.action === ChatBotAction.ThinkingStep ||
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
      messageHistory.at(-1)?.type !== ChatBotMessageType.Human
    ) {
      const lastMessageIndex = messageHistory.length - 1;
      const lastMessage = messageHistory[lastMessageIndex]!;
      if (messageTokens[lastMessageIndex] === undefined) {
        messageTokens[lastMessageIndex] = [];
      }
      lastMessage.tokens = messageTokens[lastMessageIndex];
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

      // Handle thinking steps
      if (response.action === ChatBotAction.ThinkingStep && content) {
        const currentThinkingSteps = lastMessage.thinkingSteps || [];
        lastMessage.thinkingSteps = [...currentThinkingSteps, content];
        // Set thinking to false if this is the "Done" step, otherwise true
        lastMessage.isThinking = content !== "Done";
      }

      // Clear thinking state on final response
      if (response.action === ChatBotAction.FinalResponse) {
        lastMessage.isThinking = false;
      }

      if (hasContent || lastMessage.content.length > 0) {
        // For LLMNewToken, build content from tokens if no direct content
        let messageContent = content ?? lastMessage.content;
        if (
          response.action === ChatBotAction.LLMNewToken &&
          !hasContent &&
          hasToken
        ) {
          // Accumulate token content
          const allTokens = hasToken
            ? [...(lastMessage.tokens || []), token]
            : lastMessage.tokens || [];
          messageContent = allTokens.map((t) => t.value).join("");
        }

        messageHistory[messageHistory.length - 1] = {
          ...lastMessage,
          type: ChatBotMessageType.AI,
          content: messageContent,
          metadata,
          tokens: hasToken
            ? [...(lastMessage.tokens || []), token]
            : lastMessage.tokens,
          thinkingSteps: lastMessage.thinkingSteps,
          isThinking: lastMessage.isThinking,
        };
      } else {
        messageHistory[messageHistory.length - 1] = {
          ...lastMessage,
          type: ChatBotMessageType.AI,
          content: "",
          metadata,
          tokens: hasToken
            ? [...(lastMessage.tokens || []), token]
            : lastMessage.tokens,
          thinkingSteps: lastMessage.thinkingSteps,
          isThinking: lastMessage.isThinking,
        };
      }
    } else {
      // Only create new messages for actual content or tokens, not thinking steps
      if (hasContent && response.action !== ChatBotAction.ThinkingStep) {
        const tokens = hasToken ? [token] : [];
        const newMessage = {
          type: ChatBotMessageType.AI,
          content,
          metadata,
          tokens,
          thinkingSteps: [],
          isThinking: false,
        };
        messageHistory.push(newMessage);
      } else if (typeof token !== "undefined") {
        messageHistory.push({
          type: ChatBotMessageType.AI,
          content: token.value,
          metadata,
          tokens: [token],
          thinkingSteps: [],
          isThinking: false,
        });
      } else if (response.action === ChatBotAction.ThinkingStep && content) {
        // Create a new message for thinking steps if no message exists
        const newMessage = {
          type: ChatBotMessageType.AI,
          content: "",
          metadata,
          tokens: [],
          thinkingSteps: [content],
          isThinking: content !== "Done",
        };
        messageHistory.push(newMessage);
      }
    }
  } else {
    console.error(`Unrecognized type ${response.action}`);
  }
}

export function updateChatSessions(
  chatSession: ChatSession,
  response: ChatBotMessageResponse
): void {
  if (response.data?.sessionId !== chatSession.id) return;

  const messageHistory = chatSession.messageHistory;
  if (
    response.action === ChatBotAction.FinalResponse ||
    response.action === ChatBotAction.ThinkingStep ||
    response.action === ChatBotAction.Error
  ) {
    chatSession.running = false;
  }
  if (
    response.action === ChatBotAction.LLMNewToken ||
    response.action === ChatBotAction.FinalResponse ||
    response.action === ChatBotAction.ThinkingStep ||
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
      if (lastMessage.metadata !== undefined) {
        return;
      }
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
        chatSession.messageHistory = [
          ...messageHistory.slice(0, messageHistory.length - 1),
          {
            ...lastMessage,
            type: ChatBotMessageType.AI,
            content,
            metadata,
            tokens: lastMessage.tokens,
          },
        ];
      } else {
        const contentFromTokens = lastMessage.tokens
          .map((c) => c.value)
          .join("");
        chatSession.messageHistory = [
          ...messageHistory.slice(0, messageHistory.length - 1),
          {
            ...lastMessage,
            type: ChatBotMessageType.AI,
            content: contentFromTokens,
            metadata,
            tokens: lastMessage.tokens,
          },
        ];
      }
    } else {
      if (hasContent) {
        const tokens = hasToken ? [token] : [];
        chatSession.messageHistory = [
          ...messageHistory,
          {
            type: ChatBotMessageType.AI,
            content,
            metadata,
            tokens,
          },
        ];
      } else if (typeof token !== "undefined") {
        chatSession.messageHistory = [
          ...messageHistory,
          {
            type: ChatBotMessageType.AI,
            content: token.value,
            metadata,
            tokens: [token],
          },
        ];
      }
    }
  }
}

export function getSelectedModelMetadata(
  models: Model[] | undefined,
  selectedModelOption: SelectProps.Option | null
): Model | null {
  let selectedModelMetadata: Model | null = null;

  if (selectedModelOption) {
    const { name, provider } = OptionsHelper.parseValue(
      selectedModelOption.value
    );
    const targetModel = models?.find(
      (m) => m.name === name && m.provider === provider
    );

    if (targetModel) {
      selectedModelMetadata = targetModel;
    }
  }

  return selectedModelMetadata;
}
