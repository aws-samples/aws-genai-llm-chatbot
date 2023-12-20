import {
  Box,
  SpaceBetween,
  Table,
  Pagination,
  Button,
  TableProps,
} from "@cloudscape-design/components";
import { DateTime } from "luxon";
import { useState, useEffect, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import RouterButton from "../wrappers/router-button";
import { Session } from "../../API";

export interface SessionsProps {
  toolsOpen: boolean;
}

export default function Sessions(props: SessionsProps) {
  const appContext = useContext(AppContext);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { items, collectionProps, paginationProps } = useCollection(sessions, {
    filtering: {
      empty: (
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No sessions</b>
          </SpaceBetween>
        </Box>
      ),
    },
    pagination: { pageSize: 18 },
    sorting: {
      defaultState: {
        sortingColumn: {
          sortingField: "startTime",
        },
        isDescending: true,
      },
    },
    selection: {},
  });

  const getSessions = useCallback(async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    try {
      const result = await apiClient.sessions.getSessions();
      setSessions(result.data!.listSessions);
    } catch (e) {
      console.log(e);
      setSessions([]);
    }
  }, [appContext]);

  useEffect(() => {
    if (!appContext) return;
    if (!props.toolsOpen) return;

    (async () => {
      setIsLoading(true);
      await getSessions();
      setIsLoading(false);
    })();
  }, [appContext, getSessions, props.toolsOpen]);

  const deleteSession = async (sessionId: string) => {
    if (!appContext) return;

    setIsLoading(true);
    const apiClient = new ApiClient(appContext);
    await apiClient.sessions.deleteSession(sessionId);
    await getSessions();
    setIsLoading(false);
  };

  const deleteUserSessions = async () => {
    if (!appContext) return;
    if (!confirm("Are you sure you want to delete all sessions?")) return;

    setIsLoading(true);
    const apiClient = new ApiClient(appContext);
    await apiClient.sessions.deleteSessions();
    await getSessions();
    setIsLoading(false);
  };

  return (
    <div style={{ padding: "0px 14px" }}>
      <Table
        {...collectionProps}
        variant="embedded"
        items={items}
        pagination={<Pagination {...paginationProps} />}
        loadingText="Loading history"
        loading={isLoading}
        resizableColumns
        header={
          <div style={{ paddingTop: "4px" }}>
            <h2>History</h2>
            <div>
              <SpaceBetween direction="horizontal" size="m" alignItems="center">
                <RouterButton
                  iconName="add-plus"
                  href={`/chatbot/playground/${uuidv4()}`}
                  variant="inline-link"
                >
                  New session
                </RouterButton>
                <Button
                  iconAlt="Refresh list"
                  iconName="refresh"
                  variant="inline-link"
                  onClick={() => getSessions()}
                >
                  Refresh
                </Button>
                <Button
                  iconAlt="Delete all sessions"
                  iconName="delete-marker"
                  variant="inline-link"
                  onClick={() => deleteUserSessions()}
                >
                  Delete all sessions
                </Button>
              </SpaceBetween>
            </div>
          </div>
        }
        columnDefinitions={
          [
            {
              id: "title",
              header: "Title",
              sortingField: "title",
              cell: (e) => (
                <Link to={`/chatbot/playground/${e.id}`}>{e.title}</Link>
              ),
              isRowHeader: true,
            },
            {
              id: "startTime",
              header: "Time",
              sortingField: "startTime",
              cell: (e: Session) =>
                DateTime.fromISO(
                  new Date(e.startTime).toISOString()
                ).toLocaleString(DateTime.DATETIME_SHORT),
              sortingComparator: (a, b) => {
                return (
                  new Date(b.startTime).getTime() -
                  new Date(a.startTime).getTime()
                );
              },
            },
            {
              id: "open",
              header: "Open",
              cell: (item) => (
                <RouterButton
                  variant="inline-link"
                  href={`/chatbot/playground/${item.id}`}
                >
                  Open
                </RouterButton>
              ),
            },
            {
              id: "delete",
              header: "Delete",
              cell: (item) => (
                <Button
                  variant="inline-link"
                  onClick={() => deleteSession(item.id)}
                >
                  Delete
                </Button>
              ),
            },
          ] as TableProps.ColumnDefinition<Session>[]
        }
      />
    </div>
  );
}
