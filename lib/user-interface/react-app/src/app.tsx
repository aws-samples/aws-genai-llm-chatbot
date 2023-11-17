import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import GlobalHeader from "./components/global-header";
import Dashboard from "./pages/rag/dashboard/dashboard";
import NotFound from "./pages/not-found";
import Workspaces from "./pages/rag/workspaces/workspaces";
import Engines from "./pages/rag/engines/engines";
import CreateWorkspace from "./pages/rag/create-workspace/create-workspace";
import Embeddings from "./pages/rag/embeddings/embeddings";
import CrossEncoders from "./pages/rag/cross-encoders/cross-encoders";
import Welcome from "./pages/welcome";
import Playground from "./pages/chatbot/playground/playground";
import Models from "./pages/chatbot/models/models";
import Workspace from "./pages/rag/workspace/workspace";
import SemanticSearch from "./pages/rag/semantic-search/semantic-search";
import AddData from "./pages/rag/add-data/add-data";
import "./styles/app.scss";
import MultiChatPlayground from "./pages/chatbot/playground/multi-chat-playground";
import RssFeed from "./pages/rag/workspace/rss-feed";

function App() {
  return (
    <div style={{ height: "100%" }}>
      <BrowserRouter>
        <GlobalHeader />
        <div style={{ height: "56px", backgroundColor: "#000716" }}>&nbsp;</div>
        <div>
          <Routes>
            <Route index path="/" element={<Welcome />} />
            <Route path="/chatbot" element={<Outlet />}>
              <Route path="playground" element={<Playground />} />
              <Route path="playground/:sessionId" element={<Playground />} />
              <Route path="multichat" element={<MultiChatPlayground />} />
              <Route path="models" element={<Models />} />
            </Route>
            <Route path="/rag" element={<Outlet />}>
              <Route path="" element={<Dashboard />} />
              <Route path="engines" element={<Engines />} />
              <Route path="embeddings" element={<Embeddings />} />
              <Route path="cross-encoders" element={<CrossEncoders />} />
              <Route path="semantic-search" element={<SemanticSearch />} />
              <Route path="workspaces" element={<Workspaces />} />
              <Route path="workspaces/create" element={<CreateWorkspace />} />
              <Route path="workspaces/:workspaceId" element={<Workspace />} />
              <Route
                path="workspaces/:workspaceId/rss/:feedId"
                element={<RssFeed />}
              />
              <Route path="workspaces/add-data" element={<AddData />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
