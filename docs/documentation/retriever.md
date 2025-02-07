# Document stores

## Add a new engine 
This solution uses "pluggable" document stores to implement RAG, also called **engines**. A document store implementation must provide the following functions:

- a **query** function to retrieve documents from the store. The function is invoked with the following parameters:
  - `workspace_id`: str - the workspace id
  - `workspace`: dict: a dictionary containing additional metadata related to your datastore
  - `query`: str - the query to search the documents
  - `full_response`: boolean - a flag indicating if the response should also include the retrieval scores
- a **create** function that gets invoked when a new workspace using this document store is created. Perform any operations needed to create resources that needs to be exclusively associated with the workspace
- a **delete** function that gets invoked when a workspace is removed. Cleanup any resources you have might have created that are to the exclusive use of the workspace

Additional engines can be added. To keep the current convention, create a new folder inside `layers/python-sdk/python/genai_core/` called after your engine in which you create the different functions. Export all the different functions via an `__init__.py` file in the same folder.

You need to modify the `semantic_search.py` file to add the invocation for your query function based on the type of engine.

You also need to add a specific `create_workspace_<engine>` in the `workspaces.py` file. This function is then invoked by the Amazon AppSync when query or managing a workspace `lib/chatbot-api/functions/api-handler/routes/workspaces.py`.

To add a new engine, you also need to updage the GraphQL Schema `lib/chatbot-api/schema/schema.graphql` and implement the related field in the function mentioned above.

The call to the **delete** function for your workspace must be added to the `rag-engines/workspaces/functions/delete-workspace-workflow/delete/index.py` function.

The support for your workspace type must also be added to the front-end.

- `react-app/src/components/pages/rag/workspace` to implement the document store specific settings
- `react-app/src/components/pages/rag/create-workspace` to implement components necessary to create a new workspace based on this document store

## Customize the number of results in the context
By default, the project provides 3 chunks of your documents to the model. The goal is to keep a small context window size when creating providers (Amazon Bedkrock Pricing is based on the number of tokens for example). You can however change this value and you might get better results for your use case. (See `genai_core.semantic_search.semantic_search` in `lib/shared/layers/python-sdk/python/genai_core/langchain/workspace_retriever.py`)

## Customize chunks size
When a document or a website is added to a workspace, the document will be splitted in chunks. A subset of these chunks will be sent to the model as part of the context window allowing the Large Language Model to get meaningfull context without having to parse all the source material.

If you are using a non-managed engine (Aurora or OpenSearch), the chunk generation could be updated based on your use case.

The default stategy uses [LangChain recursive text splitter](https://python.langchain.com/docs/how_to/recursive_text_splitter/) which is efficient for unstructured text but could be changed for specific use cases. Langchain provides [several chunking strategies](https://api.python.langchain.com/en/latest/text_splitters_api_reference.html#module-langchain_text_splitters.character) that could be added for your case.

To add a new strategy:
* Add support to the front end workspace form or change the hardcoded value (see for example `lib/user-interface/react-app/src/pages/rag/create-workspace/create-workspace-aurora.tsx`, it is set to `recursive`).
* Update the API validation to allow addition chunking strategies in `lib/chatbot-api/functions/api-handler/routes/workspaces.py`.
* Implement the new stategy in method `split_content` in `lib/shared/layers/python-sdk/python/genai_core/chunks.py`.

