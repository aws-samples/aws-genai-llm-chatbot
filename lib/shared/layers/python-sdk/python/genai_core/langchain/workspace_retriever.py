from aws_lambda_powertools import Logger
import genai_core.semantic_search
from typing import List
from langchain.callbacks.manager import CallbackManagerForRetrieverRun
from langchain.schema import BaseRetriever, Document

logger = Logger()


class WorkspaceRetriever(BaseRetriever):
    workspace_id: str
    documents_found: List[Document] = []

    def get_last_search_documents(self) -> List[Document]:
        return self.documents_found

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        logger.debug("SearchRequest", query=query)
        result = genai_core.semantic_search.semantic_search(
            self.workspace_id, query, limit=3, full_response=False
        )

        self.documents_found = [
            self._get_document(item) for item in result.get("items", [])
        ]
        return self.documents_found

    def _get_document(self, item):
        content = item["content"]
        content_complement = item.get("content_complement")

        page_content = content
        if content_complement:
            page_content = content_complement

        metadata = {
            "chunk_id": item["chunk_id"],
            "workspace_id": item["workspace_id"],
            "document_id": item["document_id"],
            "document_sub_id": item["document_sub_id"],
            "document_type": item["document_type"],
            "document_sub_type": item["document_sub_type"],
            "path": item["path"],
            "title": item["title"],
            "score": item["score"],
        }

        return Document(page_content=page_content, metadata=metadata)
