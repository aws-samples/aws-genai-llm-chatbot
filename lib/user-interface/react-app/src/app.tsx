import { HashRouter, BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import GlobalHeader from "./components/global-header";
import Dashboard from "./pages/rag/dashboard/dashboard";
import NotFound from "./pages/not-found";
import Workspaces from "./pages/rag/workspaces/workspaces";
import Engines from "./pages/rag/engines/engines";
import CreateWorkspace from "./pages/rag/create-workspace/create-workspace";
import Embeddings from "./pages/rag/embeddings/embeddings";
import CrossEncoders from "./pages/rag/cross-encoders/cross-encoders";
import Playground from "./pages/chatbot/playground/playground";
import Models from "./pages/chatbot/models/models";
import WorkspacePane from "./pages/rag/workspace/workspace";
import SemanticSearch from "./pages/rag/semantic-search/semantic-search";
import AddData from "./pages/rag/add-data/add-data";
import "./styles/app.scss";
import MultiChatPlayground from "./pages/chatbot/playground/multi-chat-playground";
import RssFeed from "./pages/rag/workspace/rss-feed";
import * as InfraConfig from '../../../../bin/config.json';
import Embedded from "./pages/chatbot/embedded/embedded.tsx";
import GlobalFooter from "./components/global-footer.tsx";


const subHeaderWrapperStyles = {
  fontSize: '1.6rem',
  lineHeight: '1.95em',
  color: '#666666',
  backgroundColor: '#FFFFFF',
  // position: 'relative',
  display: 'block'
}
const subHeaderStyles = {
  backgroundColor: 'rgba(16, 16, 16, 0.5)',
  padding: '0.5rem 1.5rem',
  position: 'fixed',
  zIndex: 1000,
  display: 'block',
  left: 0,
  right: 0,
}
const Layout = () => (
  <>
    <GlobalHeader />
    <div style={{ height: 56, backgroundColor: "#000716" }} />
    <div>
      <div style={subHeaderWrapperStyles}>
        <div style={subHeaderStyles}>
          <a href="https://www.deltacollege.edu/">
            <img alt="San Joaquin Delta College Logo - Home" className="desktop" src="https://www.deltacollege.edu/sites/default/files/images/delta-logo.jpg" style={{ height: 98, maxHeight: '100%'}} />
            <img alt="San Joaquin Delta College Logo - Home" className="mobile" src="https://www.deltacollege.edu/sites/default/files/images/header-mobile-logo.jpg" style={{ height: 70, maxHeight: '100%'}} />
          </a>
        </div>
      </div>
      <div style={{ height: 115, backgroundColor: '#ffffff' }} />
      <Outlet />
      <GlobalFooter />
    </div>
  </>
)

function App() {
  const Router = InfraConfig.privateWebsite ? HashRouter : BrowserRouter;

  return (
    <div
      style={{
        height: "100%",
        backgroundColor: "#f9c623"
      }}
    >
      <Router>
          <Routes>
            <Route path="/embedded" element={<Embedded />} /> 
            <Route path="/" element={<Layout />}>
              <Route index element={<Playground />} />
              <Route path="/chatbot" element={<Outlet />}>
                <Route path="playground" element={<Playground />} />
                <Route path="playground/:sessionId" element={<Playground />} />
                <Route path="multichat" element={<MultiChatPlayground />} />
                <Route path="models" element={<Models />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
      </Router>
    </div>
  );
}

export default App;
