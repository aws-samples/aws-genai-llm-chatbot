# Access Control

**NOTE**

You need to assign the admin role to a user to be able to use the project after the first deployment revision with this feature. Users without a role will not be able to use the Chatbot.


Users can have one or more roles defining their permissions. It can be used to restrict access to the functionalities as defined below.


The GenAI Chatbot on AWS has 3 pre-defined roles. They are created during deployment by CDK code. 
1. admin - _full access_
2. workspace_manager - _full access except the admin pages such as managing applications_
3. user - _access to assigned applications_

Instead of using pre-defined `user` role you can create new roles in Cognito and assign them to applications.


## Create users and Roles

Users are created in Cognito user pool - [Create new users](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-create-user-accounts.html). If Cognito federation is used then users should be created in third-party identity provider. See [Cognito Federation](./cognito/overview.md) configuration examples. 

User roles are defined using [Cognito user group](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-user-groups.html). When using federation with Cognito, the user's role is assigned on user log in reading the "custom:chatbot_role" user attribute. 


## Page Access by Role

* **admin**
    * ✅ Home (documentation)
    * ✅ Chatbot - Playground
    * ✅ Chatbot - Multi-chat playground
    * ✅ Chatbot - Sessions
    * ✅ Chatbot - Models
    * ✅ RAG - Dashboard
    * ✅ RAG - Semantic search
    * ✅ RAG - Workspaces
    * ✅ RAG - Embeddings
    * ✅ RAG - Engines
    * ✅ Admin - Applications
    * ✅ Applications - End user view

* **workspaces_manager**
    * ✅ Home (documentation)
    * ✅ Chatbot - Playground
    * ✅ Chatbot - Multi-chat playground
    * ✅ Chatbot - Sessions
    * ✅ Chatbot - Models
    * ✅ RAG - Dashboard
    * ✅ RAG - Semantic search
    * ✅ RAG - Workspaces
    * ✅ RAG - Embeddings
    * ✅ RAG - Engines
    * ⛔️ Admin - Applications
    * ✅ Applications - End user view

* **user**: 
It could be a role with any name which is associated with an application.
    * ⛔️ Home (documentation)
    * ⛔️ Chatbot - Playground
    * ⛔️ Chatbot - Multi-chat playground
    * ⛔️ Chatbot - Sessions
    * ⛔️ Chatbot - Models
    * ⛔️ RAG - Dashboard
    * ⛔️ RAG - Semantic search
    * ⛔️ RAG - Workspaces
    * ⛔️ RAG - Embeddings
    * ⛔️ RAG - Engines
    * ⛔️ Admin - Applications
    * ✅ Applications - End user view


## GraphQL operations access by Role

* **Workspace**
    * createKendraWorkspace - _admin, workspace_manager_
    * startKendraDataSync - _admin, workspace_manager_
    * isKendraDataSynching - _admin, workspace_manager_
    * createBedrockKBWorkspace - _admin, workspace_manager_
    * createOpenSearchWorkspace - _admin, workspace_manager_
    * createAuroraWorkspace - _admin, workspace_manager_
    * performSemanticSearch - _admin, workspace_manager_
    * listWorkspaces - _admin, workspace_manager_
    * listKendraIndexes - _admin, workspace_manager_
    * listBedrockKnowledgeBases - _admin, workspace_manager_
    * listRagEngines - _admin, workspace_manager_
    * getWorkspace - _admin, workspace_manager_
    * deleteWorkspace - _admin, workspace_manager_

* **Document**
    * addWebsite - _admin, workspace_manager_
    * addRssFeed - _admin, workspace_manager_
    * updateRssFeed - _admin, workspace_manager_
    * setDocumentSubscriptionStatus - _admin, workspace_manager_
    * addQnADocument - _admin, workspace_manager_
    * addTextDocument - _admin, workspace_manager_
    * getUploadFileURL - _any authenticated user_
    * getDocument - _admin, workspace_manager_
    * getRSSPosts - _admin, workspace_manager_
    * listDocuments - _admin, workspace_manager_
    * deleteDocument - _admin, workspace_manager_

* **Session**
    * addUserFeedback - _any authenticated user_
    * deleteSession - _any authenticated user_
    * deleteUserSessions - _any authenticated user_
    * listSessions - _any authenticated user_
    * getSession - _any authenticated user_

* **Model**
    * listModels - _admin, workspace_manager_
    * listEmbeddingModels - _admin, workspace_manager_
    * listCrossEncoders - _admin, workspace_manager_
    * rankPassages - _admin, workspace_manager_
    * calculateEmbeddings - _admin, workspace_manager_
    * sendQuery - _any authenticated user_
    * receiveMessages - _any authenticated user_

* **Application**
    * createApplication - _admin_
    * updateApplication - _admin_
    * deleteApplication - _admin_
    * getApplication - _admin, workspace_manager, any other role that is assigned to the application_
    * listApplications - _admin, workspace_manager, any other role that is assigned to the application_

* **Role**
    * listRoles - _admin_

* **Internal**
    * publishResponse - _IAM Can only be called by the Lambda forwarding the chatbot responses_

* **Other**
    * checkHealth - _any authenticated user_
