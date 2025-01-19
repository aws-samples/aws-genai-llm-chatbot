import {
  Table,
  Header,
  SpaceBetween,
  Button,
  Pagination,
} from "@cloudscape-design/components";
import { useCallback, useContext, useEffect, useState } from "react";
import { RagDocumentType } from "../../../common/types";
import RouterButton from "../../../components/wrappers/router-button";
import { TableEmptyState } from "../../../components/table-empty-state";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { getColumnDefinition } from "./columns";
import { Utils } from "../../../common/utils";
import { Document, DocumentsResult } from "../../../API";
import DocumentDeleteModal from "../../../components/rag/document-delete-modal";

export interface DocumentsTabProps {
  workspaceId?: string;
  documentType: RagDocumentType;
}

export default function DocumentsTab(props: DocumentsTabProps) {
  const appContext = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pages, setPages] = useState<(DocumentsResult | undefined)[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<
    Document | undefined
  >();

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const getDocuments = useCallback(
    async (params: { lastDocumentId?: string; pageIndex?: number }) => {
      if (!appContext) return;
      if (!props.workspaceId) return;

      setLoading(true);

      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.documents.getDocuments(
          props.workspaceId,
          props.documentType,
          params?.lastDocumentId
        );

        setPages((current) => {
          const foundIndex = current.findIndex(
            (c) =>
              c!.lastDocumentId === result.data!.listDocuments.lastDocumentId
          );

          if (foundIndex !== -1) {
            current[foundIndex] = result.data?.listDocuments;
            return [...current];
          } else if (typeof params.pageIndex !== "undefined") {
            current[params.pageIndex - 1] = result.data?.listDocuments;
            return [...current];
          } else if (result.data?.listDocuments.items.length === 0) {
            return current;
          } else {
            return [...current, result.data?.listDocuments];
          }
        });
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
      }

      setLoading(false);
    },
    [appContext, props.documentType, props.workspaceId]
  );

  useEffect(() => {
    getDocuments({});
  }, [getDocuments]);

  const onNextPageClick = async () => {
    const lastDocumentId = pages[currentPageIndex - 1]?.lastDocumentId;

    if (lastDocumentId) {
      if (pages.length <= currentPageIndex) {
        await getDocuments({ lastDocumentId });
      }

      setCurrentPageIndex((current) => Math.min(pages.length + 1, current + 1));
    }
  };

  const onPreviousPageClick = async () => {
    setCurrentPageIndex((current) =>
      Math.max(1, Math.min(pages.length - 1, current - 1))
    );
  };

  const refreshPage = async () => {
    if (currentPageIndex <= 1) {
      await getDocuments({ pageIndex: currentPageIndex });
    } else {
      /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
      const lastDocumentId = pages[currentPageIndex - 2]?.lastDocumentId!;
      await getDocuments({ lastDocumentId });
    }
  };

  const handleDelete = async (document: Document) => {
    setDocumentToDelete(document);
    setIsModalOpen(true);
  };

  const handleOnDeleteOfModal = () => {
    if (documentToDelete?.id) {
      handleConfirmDelete(documentToDelete.id);
      setDocumentToDelete(undefined);
      setIsModalOpen(false);
    }
  };

  /* eslint-disable */
  const handleConfirmDelete = async (documentId: string) => {
    if (!appContext || !props.workspaceId) return;

    const apiClient = new ApiClient(appContext);

    try {
      await apiClient.documents.deleteDocument(props.workspaceId, documentId);

      setTimeout(async () => {
        refreshPage();
      }, 1500);
    } catch (error) {
      console.error("An error occurred while deleting the document:", error);
    }
  };

  const typeStr = ragDocumentTypeToString(props.documentType);
  const typeAddStr = ragDocumentTypeToAddString(props.documentType);
  const typeTitleStr = ragDocumentTypeToTitleString(props.documentType);

  const columnDefinitions = getColumnDefinition(
    props.documentType,
    handleDelete
  );

  return (
    <>
      {isModalOpen && (
        <DocumentDeleteModal
          visible={isModalOpen}
          onDelete={handleOnDeleteOfModal}
          onDiscard={handleCloseModal}
          document={documentToDelete}
        />
      )}
      <Table
        loading={loading}
        loadingText={`Loading ${typeStr}s`}
        columnDefinitions={columnDefinitions}
        items={pages[Math.min(pages.length - 1, currentPageIndex - 1)]?.items!}
        header={
          <Header
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={refreshPage} />
                <RouterButton
                  href={`/rag/workspaces/add-data?workspaceId=${props.workspaceId}&tab=${props.documentType}`}
                  data-locator="add-link"
                >
                  {typeAddStr}
                </RouterButton>
              </SpaceBetween>
            }
            description="Please expect a delay for your changes to be reflected. Press the refresh button to see the latest changes."
          >
            {typeTitleStr}
          </Header>
        }
        empty={
          <TableEmptyState
            resourceName={typeStr}
            createHref={`/rag/workspaces/add-data?workspaceId=${props.workspaceId}&tab=${props.documentType}`}
            createText={typeAddStr}
          />
        }
        pagination={
          pages.length === 0 ? null : (
            <Pagination
              openEnd={true}
              pagesCount={0}
              currentPageIndex={currentPageIndex}
              onNextPageClick={onNextPageClick}
              onPreviousPageClick={onPreviousPageClick}
            />
          )
        }
      />
    </>
  );
}

function ragDocumentTypeToString(type: RagDocumentType) {
  switch (type) {
    case "file":
      return "File";
    case "text":
      return "Text";
    case "qna":
      return "Q&A";
    case "website":
      return "Website";
    case "rssfeed":
      return "RSS Feed";
    case "rsspost":
      return "RSS Post";
  }
}

function ragDocumentTypeToTitleString(type: RagDocumentType) {
  switch (type) {
    case "file":
      return "Files";
    case "text":
      return "Texts";
    case "qna":
      return "Q&As";
    case "website":
      return "Websites";
    case "rssfeed":
      return "RSS Feeds";
    case "rsspost":
      return "RSS Posts";
  }
}

function ragDocumentTypeToAddString(type: RagDocumentType) {
  switch (type) {
    case "file":
      return "Upload files";
    case "text":
      return "Add texts";
    case "qna":
      return "Add Q&A";
    case "website":
      return "Crawl website";
    case "rssfeed":
      return "Subcribe to RSS Feed";
    case "rsspost":
      return "Add RSS Post";
  }
}
