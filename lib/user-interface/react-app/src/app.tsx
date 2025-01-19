import { useContext } from "react";
import {
  BrowserRouter,
  HashRouter,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AppContext } from "./common/app-context";
import Models from "./pages/chatbot/models/models";
import MultiChatPlayground from "./pages/chatbot/playground/multi-chat-playground";
import Playground from "./pages/chatbot/playground/playground";
import NotFound from "./pages/not-found";
import AddData from "./pages/rag/add-data/add-data";
import CreateWorkspace from "./pages/rag/create-workspace/create-workspace";
import CrossEncoders from "./pages/rag/cross-encoders/cross-encoders";
import Dashboard from "./pages/rag/dashboard/dashboard";
import Embeddings from "./pages/rag/embeddings/embeddings";
import Engines from "./pages/rag/engines/engines";
import SemanticSearch from "./pages/rag/semantic-search/semantic-search";
import RssFeed from "./pages/rag/workspace/rss-feed";
import WorkspacePane from "./pages/rag/workspace/workspace";
import Workspaces from "./pages/rag/workspaces/workspaces";
import Welcome from "./pages/welcome";
import "./styles/app.scss";
import SessionPage from "./pages/chatbot/sessions/sessions";
import Applications from "./pages/admin/applications/applications";
import ManageApplication from "./pages/admin/manage-application/manage-application";
import ApplicationChat from "./pages/application/application";
import Layout from "./layout";
import { UserContext } from "./common/user-context";
import { UserRole } from "./common/types";

function App() {
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const Router = appContext?.config.privateWebsite ? HashRouter : BrowserRouter;

  return (
    <div style={{ height: "100%" }}>
      <Router>
        <div>
          <Routes>
            <Route
              index
              path="/application/:applicationId"
              element={
                <Layout showHeader={false}>
                  <ApplicationChat />
                </Layout>
              }
            />
            {userContext?.userRoles !== undefined &&
              (userContext?.userRoles.includes(UserRole.ADMIN) ||
                userContext?.userRoles.includes(
                  UserRole.WORKSPACE_MANAGER
                )) && (
                <>
                  <Route
                    index
                    path="/"
                    element={
                      <Layout showHeader={true}>
                        <Welcome />
                      </Layout>
                    }
                  />
                  <Route path="/chatbot" element={<Outlet />}>
                    <Route
                      path="playground"
                      element={
                        <Layout showHeader={true}>
                          <Playground />
                        </Layout>
                      }
                    />
                    <Route
                      path="playground/:sessionId"
                      element={
                        <Layout showHeader={true}>
                          <Playground />
                        </Layout>
                      }
                    />
                    <Route
                      path="sessions"
                      element={
                        <Layout showHeader={true}>
                          <SessionPage />
                        </Layout>
                      }
                    />
                    <Route
                      path="multichat"
                      element={
                        <Layout showHeader={true}>
                          <MultiChatPlayground />
                        </Layout>
                      }
                    />
                    <Route
                      path="models"
                      element={
                        <Layout showHeader={true}>
                          <Models />
                        </Layout>
                      }
                    />
                  </Route>
                  <Route
                    path="/rag"
                    element={
                      <Layout showHeader={true}>
                        <Outlet />
                      </Layout>
                    }
                  >
                    <Route
                      path=""
                      element={
                        <Layout showHeader={true}>
                          <Dashboard />
                        </Layout>
                      }
                    />
                    <Route
                      path="engines"
                      element={
                        <Layout showHeader={true}>
                          <Engines />
                        </Layout>
                      }
                    />
                    <Route
                      path="embeddings"
                      element={
                        <Layout showHeader={true}>
                          <Embeddings />
                        </Layout>
                      }
                    />
                    <Route
                      path="cross-encoders"
                      element={
                        <Layout showHeader={true}>
                          <CrossEncoders />
                        </Layout>
                      }
                    />
                    <Route
                      path="semantic-search"
                      element={
                        <Layout showHeader={true}>
                          <SemanticSearch />
                        </Layout>
                      }
                    />
                    <Route
                      path="workspaces"
                      element={
                        <Layout showHeader={true}>
                          <Workspaces />
                        </Layout>
                      }
                    />
                    <Route
                      path="workspaces/create"
                      element={
                        <Layout showHeader={true}>
                          <CreateWorkspace />
                        </Layout>
                      }
                    />
                    <Route
                      path="workspaces/:workspaceId"
                      element={
                        <Layout showHeader={true}>
                          <WorkspacePane />
                        </Layout>
                      }
                    />
                    <Route
                      path="workspaces/:workspaceId/rss/:feedId"
                      element={
                        <Layout showHeader={true}>
                          <RssFeed />
                        </Layout>
                      }
                    />
                    <Route
                      path="workspaces/add-data"
                      element={
                        <Layout showHeader={true}>
                          <AddData />
                        </Layout>
                      }
                    />
                  </Route>
                </>
              )}

            {userContext?.userRoles !== undefined &&
              userContext?.userRoles.includes(UserRole.ADMIN) && (
                <>
                  <Route
                    path="/admin"
                    element={
                      <Layout showHeader={true}>
                        <Outlet />
                      </Layout>
                    }
                  >
                    <Route
                      path="applications"
                      element={
                        <Layout showHeader={true}>
                          <Applications />
                        </Layout>
                      }
                    />
                    <Route
                      path="applications/manage"
                      element={
                        <Layout showHeader={true}>
                          <ManageApplication />
                        </Layout>
                      }
                    />
                    <Route
                      path="applications/manage/:applicationId"
                      element={
                        <Layout showHeader={true}>
                          <ManageApplication />
                        </Layout>
                      }
                    />
                  </Route>
                </>
              )}

            <Route
              path="*"
              element={
                <Layout showHeader={true}>
                  <NotFound />
                </Layout>
              }
            />
          </Routes>
        </div>
      </Router>
    </div>
  );
}

export default App;
