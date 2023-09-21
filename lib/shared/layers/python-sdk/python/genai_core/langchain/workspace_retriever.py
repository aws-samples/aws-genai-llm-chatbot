from typing import List
import genai_core.semantic_search
from langchain.callbacks.manager import CallbackManagerForRetrieverRun
from langchain.schema import BaseRetriever, Document


class WorkspaceRetriever(BaseRetriever):
    workspace_id: str

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        result = genai_core.semantic_search.semantic_search(
            self.workspace_id, query, limit=5, full_response=False)

        return [
            self._get_document(item)
            for item in result.get("items", [])
        ]

    def _get_document(self, item):
        content = item["content"]
        content_complement = item.get("content_complement")

        page_content = content
        if content_complement:
            page_content = content_complement

        return Document(page_content=page_content, metadata=item)
