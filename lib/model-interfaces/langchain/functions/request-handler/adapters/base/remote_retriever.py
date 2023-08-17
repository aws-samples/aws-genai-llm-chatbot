from typing import List, Optional

import requests
from aws_requests_auth.aws_auth import AWSRequestsAuth
from langchain.callbacks.manager import CallbackManagerForRetrieverRun
from langchain.schema import BaseRetriever, Document


class RemoteRetriever(BaseRetriever):
    url: str
    headers: Optional[dict] = None
    input_key: str = "query"
    response_key: str = "response"
    page_content_key: str = "page_content"
    metadata_key: str = "metadata"
    auth: AWSRequestsAuth

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        response = requests.post(
            self.url, auth=self.auth, json={self.input_key: query}, headers=self.headers
        )
        result = response.json()
        return [
            Document(
                page_content=r[self.page_content_key], metadata=r[self.metadata_key]
            )
            for r in result.get(self.response_key, [])
        ]
