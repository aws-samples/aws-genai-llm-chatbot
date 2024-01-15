# Document stores

This solution uses "pluggable" document stores to implement RAG, also called **engines**. A document store implementation must provide the following functions:

- a **query** function to retrieve documents from the store. The function is invoked with the following parameters:
  - `workspace_id`: str - the workspace id
  - `workspace`: dict: a dictionary containing additional metadata related to your datastore
  - `query`: str - the query to search the documents
  - `full_response`: boolean - a flag indicating if the response should also include the retrieval scores
- a **create** function that gets invoked when a new workspace using this document store is created. Perform any operations needed to create resources that needs to be exclusively associated with the workspace
- a **delete** function that gets invoked when a workspace is removed. Cleanup any resources you have might have created that are to the exclusive use of the workspace

To keep the current convention, create a new folder inside `layers/python-sdk/python/genai_core/` called after your engine in which you create the different functions. Export all the different functions via an `__init__.py` file in the same folder.

You need to modify the `semantic_search.py` file to add the invocation for your query function based on the type of engine.

You also need to add a specific `create_workspace_<engine>` in the `workspaces.py` file. This function is then invoked by the REST API workspace route handler `lib/chatbot-api/functions/api-handler/routes/workspaces.py`.

[ ] Added API handler function

[ ] Added create_workspace

The call to the **delete** function for your workspace must be added to the `rag-engines/workspaces/functions/delete-workspace-workflow/delete/index.py` function.

[ ] Added delete

The support for your workspace type must also be added to the front-end.

- `react-app/src/components/pages/rag/workspace` to implement the document store specific settings
- `react-app/src/components/pages/rag/create-workspace` to implement components necessary to create a new workspace based on this document store

[ ] Added UI
