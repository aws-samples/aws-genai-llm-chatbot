import { HashRouter, BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import GlobalHeader from "./components/global-header";
import NotFound from "./pages/not-found";
import Playground from "./pages/chatbot/playground/playground";
import Models from "./pages/chatbot/models/models";
import "./styles/app.scss";
import MultiChatPlayground from "./pages/chatbot/playground/multi-chat-playground";
import * as InfraConfig from '../../../../bin/config.json';
import Embedded from "./pages/chatbot/embedded/embedded.tsx";
import GlobalFooter from "./components/global-footer.tsx";


const subHeaderWrapperStyles = {
  fontSize: '1.6rem',
  lineHeight: '1.95em',
  color: '#666666',
  backgroundColor: '#FFFFFF',
  display: 'block'
}
const Layout = () => (
  <div style={{ backgroundColor: "#f9c623" }}>
    <GlobalHeader />
    <div style={{ height: 56, backgroundColor: "#000716" }} />
    <div>
      <div style={subHeaderWrapperStyles}>
        <div className="subHeader">
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
  </div>
)

function App() {
  const Router = InfraConfig.privateWebsite ? HashRouter : BrowserRouter;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "flex-end",
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
