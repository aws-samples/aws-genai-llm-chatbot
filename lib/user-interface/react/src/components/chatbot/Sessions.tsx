import { useState, useContext, useCallback, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { AppContext } from '../app-context';
import { Auth } from 'aws-amplify';

import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import { Pagination } from '@cloudscape-design/components';
import Button from '@cloudscape-design/components/button';
import { DateTime } from 'luxon';
import { Link } from 'react-router-dom';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { v4 as uuidv4 } from 'uuid';
import { ChatbotActions } from './types';

export function Sessions({ sessionId }) {
  const appConfig = useContext(AppContext);
  const [socketUrl, setSocketUrl] = useState<string | null>(null);
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState<object[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { items, collectionProps, paginationProps } = useCollection(sessions, {
    filtering: {
      empty: (
        <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No history</b>
          </SpaceBetween>
        </Box>
      ),
    },
    pagination: { pageSize: 20 },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: 'StartTime',
        },
        isDescending: true,
      },
    },
    selection: {},
  });

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: () => true,
  });

  const listSessions = useCallback(() => {
    setIsLoading(true);
    sendJsonMessage({ action: ChatbotActions.ListSessions });
  }, []);

  const handleIncomingMessage = (payload) => {
    switch (payload.action) {
      case ChatbotActions.ListSessions:
        setSessions(payload?.data || []);
        setIsLoading(false);
        break;
      case ChatbotActions.DeleteSession:
        listSessions();
        setIsLoading(false);
        break;
      case ChatbotActions.DeleteUserSessions:
        listSessions();
        setIsLoading(false);
        break;
      case ChatbotActions.FinalResponse:
        listSessions();
        setIsLoading(false);
        break;
      default:
        break;
    }
  };

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

  useEffect(() => {
    if (lastJsonMessage !== null) {
      handleIncomingMessage(lastJsonMessage);
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      setIsLoading(true);
      listSessions();
    }
  }, [readyState]);

  const deleteSession = async (sessionId) => {
    sendJsonMessage({ action: 'deleteSession', data: { sessionId } });
  };

  const deleteUserSessions = async () => {
    sendJsonMessage({ action: 'deleteUserSessions' });
  };

  return (
    <div className="p-5">
      <Table
        {...collectionProps}
        variant="embedded"
        items={items}
        pagination={<Pagination {...paginationProps} />}
        loadingText="Loading history"
        loading={isLoading}
        resizableColumns
        sortingDescending={true}
        columnDefinitions={[
          {
            id: 'title',
            header: 'Title',
            cell: (e) => <Link to={`/chatbot/${e.SessionId}`}>{e.History[0].data.content}</Link>,
            sortingField: 'title',
            isRowHeader: true,
          },
          {
            id: 'StartTime',
            header: 'Time',
            cell: (e) => DateTime.fromISO(new Date(e.StartTime).toISOString()).toLocaleString(DateTime.DATETIME_SHORT),
            sortingField: 'StartTime',
            sortingComparator: (a, b) => {
              return new Date(b.StartTime).getTime() - new Date(a.StartTime).getTime();
            },
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="m">
                <Button variant="inline-link">
                  <Link to={`/chatbot/${item.SessionId}`}>Open</Link>
                </Button>
                <Button variant="inline-link" onClick={() => deleteSession(item.SessionId)}>
                  Delete
                </Button>
              </SpaceBetween>
            ),
            minWidth: 170,
          },
        ]}
        header={
          <Header
            actions={
              <div className="mr-10">
                <SpaceBetween direction="horizontal" size="m">
                  <Button iconName="add-plus" variant="inline-link">
                    <Link to={`/chatbot/${uuidv4()}`}>New</Link>
                  </Button>
                  <Button iconAlt="Refresh list" iconName="refresh" variant="inline-link" onClick={() => listSessions()}>
                    Refresh
                  </Button>
                  <Button iconAlt="Delete all sessions" iconName="delete-marker" variant="inline-link" onClick={() => deleteUserSessions()}>
                    Delete all
                  </Button>
                </SpaceBetween>
              </div>
            }
          >
            History
          </Header>
        }
      />
    </div>
  );
}
export default Sessions;
