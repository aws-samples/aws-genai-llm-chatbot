// @ts-ignore
import { useState, useRef, useContext, useCallback, useEffect } from 'react';
import { AppContext } from '../app-context';
import { Auth } from 'aws-amplify';
import Form from '@cloudscape-design/components/form';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import TextareaAutosize from 'react-textarea-autosize';
import Box from '@cloudscape-design/components/box';
import { v4 as uuidv4 } from 'uuid';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Spinner from '@cloudscape-design/components/spinner';

import Toggle from '@cloudscape-design/components/toggle';
import ChatMessage from './ChatMessage';
import { TextContent } from '@cloudscape-design/components';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import { ChatbotMessageType, ChatbotActions } from './types';

export default function Chat({ sessionId }) {
  const appConfig = useContext(AppContext);
  const [value, setValue] = useState('');
  const [socketUrl, setSocketUrl] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState([]);
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: () => true,
  });
  const [user, setUser] = useState(null);
  const [models, setModels] = useState<object[] | null>(null);
  const [modelsOptions, setModelsOptions] = useState<object[]>([]); // [{ label: 'anthropic.claude-v2', value: 'anthropic.claude-v2' }
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingRagSources, setIsLoadingRagSources] = useState(false);
  const [internalSessionId, setInternalSessionId] = useState<string | null>(null);
  const bottomRef = useRef(null);

  const [ragSources, setRagSources] = useState([]);
  const [selectedRagSource, setSelectedRagSource] = useState<string | null>(null);

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        setUser(user);
      } catch (err) {
        console.log(err);
      }
    };

    getUser();
  }, []);

  useEffect(() => {
    console.log('appConfig', appConfig);
    if (appConfig && user) {
      setSocketUrl(`${appConfig.client.websocket.endpoint}?token=${user.signInUserSession.accessToken.jwtToken}`);
    }
  }, [appConfig, user]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      if (sessionId) {
        setInternalSessionId(sessionId);
        const request = {
          action: ChatbotActions.GetSession,
          data: {
            sessionId,
          },
        };
        setMessageHistory((prev) => []);
        setIsRunning(true);
        sendJsonMessage(request);
      } else {
        setInternalSessionId(uuidv4());
        setMessageHistory((prev) => []);
      }
    }
  }, [readyState, sessionId]);

  useEffect(() => {
    if (lastJsonMessage !== null) {
      console.log(lastJsonMessage);
      handleRecieveMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, setMessageHistory]);

  useEffect(() => {
    if (models) {
      const modelsOptions = models.map((model) => {
        console.log(model);
        return { label: model.label, options: model.models.map((m) => ({ label: `${m.modelId} ${m.streaming ? '(streaming supported)' : ''}`, value: m.modelId, provider: m.provider, streaming: m.streaming, type: m.type })) };
      });
      setModelsOptions(modelsOptions);
    }
  }, [models]);

  useEffect(() => {
    if (readyState === ReadyState.OPEN && !models?.length) {
      setIsLoadingModels(true);
      requestModels();
    }
    if (readyState === ReadyState.OPEN && !ragSources?.length) {
      setIsLoadingRagSources(true);
      requestRagSources();
    }
  }, [readyState]);

  useEffect(() => {
    console.log(selectedModel);
    if (selectedModel) {
      if (selectedModel.streaming) {
        setStreamingEnabled(true);
      } else {
        setStreamingEnabled(false);
        setStreaming(false);
      }
    } else {
      setStreamingEnabled(false);
      setStreaming(false);
    }
  }, [selectedModel, models]);

  useEffect(() => {
    if (transcript) {
      setValue(transcript);
    }
  }, [transcript]);

  const handleRecieveMessage = (payload) => {
    switch (payload.action) {
      case ChatbotActions.GetSession:
        setIsRunning(false);
        setMessageHistory(
          (prev) =>
            payload.data?.History?.map((turn) => {
              console.log(turn);
              return {
                type: turn.type,
                content: turn.data.content,
                metadata: JSON.parse(turn.metadata || '{}'),
              };
            }) || [],
        );
        break;

      case ChatbotActions.ListModels:
        setModels(payload.data);
        setIsLoadingModels(false);
        break;

      case ChatbotActions.ListRagSources:
        setRagSources(payload.data);
        setIsLoadingRagSources(false);
        break;

      case ChatbotActions.FinalResponse:
        if (payload.data.sessionId !== internalSessionId) {
          return;
        }
        setIsRunning(false);
        setStreamingStarted(false);
        if (messageHistory[messageHistory.length - 1]) {
          if (messageHistory[messageHistory.length - 1]['type'] === ChatbotMessageType.Human) {
            setMessageHistory((prev) =>
              prev.concat({
                type: ChatbotMessageType.AI,
                content: payload.data.content,
                metadata: payload.data?.metadata || {},
              }),
            );
          } else {
            setMessageHistory((prev) =>
              prev.slice(0, -1).concat({
                type: ChatbotMessageType.AI,
                content: payload.data.content,
                metadata: payload.data?.metadata || {},
              }),
            );
          }
        }
        break;

      case ChatbotActions.Error:
        setIsRunning(false);
        setMessageHistory((prev) =>
          prev.concat({
            type: ChatbotMessageType.AI,
            content: payload.data.content,
            metadata: payload.data?.metadata || {},
          }),
        );
        break;

      case ChatbotActions.LLMNewToken:
        if (payload.data.sessionId !== internalSessionId) {
          return;
        }
        setStreamingStarted(true);
        if (messageHistory[messageHistory.length - 1]['type'] !== ChatbotMessageType.Human) {
          const newMessage = messageHistory[messageHistory.length - 1]['content'] + payload.data.token;
          setMessageHistory((prev) =>
            prev.slice(0, -1).concat({
              type: ChatbotMessageType.AI,
              content: newMessage,
              metadata: {},
            }),
          );
        } else {
          setMessageHistory((prev) =>
            prev.concat({
              type: ChatbotMessageType.AI,
              content: payload.data.token,
              metadata: {},
            }),
          );
        }

        break;

      default:
        break;
    }
    bottomRef?.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = useCallback(() => {
    console.log('got it', selectedModel);
    const request = {
      action: ChatbotActions.Run,
      data: {
        modelId: selectedModel.value,
        provider: selectedModel.provider,
        sessionId: internalSessionId,
        text: value,
        mode: 'chain',
        ragSource: selectedRagSource?.value,
      },
    };
    if (streaming && streamingEnabled) {
      request.data.modelKwargs = { streaming: true };
    }
    console.log(request);

    setValue('');
    setIsRunning(true);
    // add the message to the history
    setMessageHistory((prev) =>
      prev.concat({
        type: ChatbotMessageType.Human,
        content: value,
        metadata: {},
      }),
    );
    bottomRef?.current.scrollIntoView({ behavior: 'smooth' });
    return sendJsonMessage(request);
  }, [selectedModel, sessionId, value, streaming, streamingEnabled]);

  const requestModels = useCallback(() => sendJsonMessage({ action: ChatbotActions.ListModels }), []);
  const requestRagSources = useCallback(() => sendJsonMessage({ action: ChatbotActions.ListRagSources }), []);

  return (
    <>
      <div className=" overflow-y-scroll p-2 mb-32">
        <SpaceBetween direction="vertical" size="x">
          {messageHistory.map((message, idx) => (
            <ChatMessage key={idx} message={message} showMetadata={showMetadata} />
          ))}
          <div ref={bottomRef} />

          {isRunning && !streamingStarted && <ChatMessage message={{ type: ChatbotMessageType.Running }} />}
        </SpaceBetween>
      </div>
      <div className="fixed bottom-0 left-0 w-full">
        <form onSubmit={(e) => e.preventDefault()}>
          <Form variant="embedded">
            <Container>
              <div className="flex">
                <div className="w-2/4">
                  {browserSupportsSpeechRecognition && (
                    <span className="mt-3 float-left">
                      <Button iconName={listening ? 'microphone-off' : 'microphone'} variant="icon" onClick={() => (listening ? SpeechRecognition.stopListening() : SpeechRecognition.startListening())} />
                    </span>
                  )}
                  <TextareaAutosize
                    className="float-left  min-w-[300px] w-2/3 border-none rounded-md p-2 focus:outline-none focus:ring-none bg-transparent resize-none p-5"
                    maxRows={4}
                    minRows={1}
                    spellCheck={true}
                    autoFocus
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key == 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    value={value}
                    placeholder={listening ? 'Listening...' : 'Type your question here'}
                  />
                </div>
                <div className="w-2/4">
                  <div className="flex mb-2 justify-end mt-3">
                    <div className="w-2/3 mr-4">
                      {ragSources.length > 0 && (
                        <Select
                          loadingText="Loading RAG sources..."
                          statusType={isLoadingRagSources ? 'loading' : 'success'}
                          placeholder="RAG source"
                          filteringType="auto"
                          selectedOption={selectedRagSource}
                          options={[{ label: 'None', value: null }, ...ragSources]}
                          onChange={({ detail }) => setSelectedRagSource(detail.selectedOption)}
                          empty={<div className="text-gray-500">No RAG sources available. If you want to use RAG make sure to deploy one or more of the available sources via CDK</div>}
                        />
                      )}
                    </div>
                    <div>
                      <Button disabled={readyState !== ReadyState.OPEN || !models?.length || isRunning} isRunning={readyState !== ReadyState.OPEN || !models?.length || isRunning} onClick={handleSendMessage} iconAlign="right" iconName="angle-right-double" variant="primary">
                        <span className="md:inline hidden">{isRunning ? 'Loading' : 'Send'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <SpaceBetween direction="vertical" size="s">
                <Select
                  disabled={isRunning}
                  statusType={isLoadingModels ? 'loading' : 'success'}
                  loadingText="Loading models (might take few seconds)..."
                  placeholder="Select a model"
                  empty={<div className="text-gray-500">No models available. Please make sure you have access to Bedrock or alternatevly deploy a self hosted model on Sagamker or add API KEY to secrets manager</div>}
                  filteringType="auto"
                  selectedOption={selectedModel}
                  onChange={({ detail }) => setSelectedModel(detail.selectedOption)}
                  options={modelsOptions}
                />
                <SpaceBetween direction="horizontal" size="m">
                  <Box float="left" variant="div">
                    <Toggle onChange={({ detail }) => setStreaming(detail.checked)} checked={streaming} disabled={!streamingEnabled || isRunning}>
                      Streaming {!streamingEnabled && selectedModel && '(not supported by this model)'}
                    </Toggle>
                  </Box>
                  <Box float="left" variant="div">
                    <Toggle onChange={({ detail }) => setShowMetadata(detail.checked)} checked={showMetadata}>
                      Show metadata
                    </Toggle>
                  </Box>
                </SpaceBetween>
              </SpaceBetween>
              <SpaceBetween direction="vertical" size="x">
                <Box float="right" variant="div">
                  <StatusIndicator type={readyState === ReadyState.OPEN ? 'success' : readyState === ReadyState.CONNECTING ? 'in-progress' : 'error'}>{readyState === ReadyState.OPEN ? 'Connected' : connectionStatus}</StatusIndicator>
                </Box>
                <Box float="rigt" variant="div">
                  <TextContent>
                    <div className="text-xs text-gray-500">Session ID: {internalSessionId}</div>
                  </TextContent>
                </Box>
              </SpaceBetween>
            </Container>
          </Form>
        </form>
      </div>
    </>
  );
}
