import 'regenerator-runtime/runtime';
import { useState, useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppLayout } from '@cloudscape-design/components';
import { AppContext } from './components/app-context';

import Home from './pages/Home';
import Chatbot from './pages/Chatbot';
import Files from './pages/Files';
import Topbar from './components/topbar';

function App() {
  const appConfig = useContext(AppContext);
  const [showTools, setShowTools] = useState(false);
  const [tools, setTools] = useState(null);

  useEffect(() => {
    if (tools) {
      setShowTools(true);
    } else {
      setShowTools(false);
    }
  }, [tools]);

  return (
    <BrowserRouter>
      <div id="h" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
        <Topbar />
      </div>
      <AppLayout
        headerSelector="#h"
        footerSelector="#f"
        navigationOpen={false}
        navigationHide={true}
        toolsHide={!showTools}
        tools={tools}
        toolsWidth={500}
        content={
          <Routes>
            <Route path="/" element={<Home setTools={setTools} />} />
            <Route path="/chatbot" element={<Chatbot setTools={setTools} />} />
            <Route path="/chatbot/:sessionId" element={<Chatbot setTools={setTools} />} />
            <Route path="/files" element={<Files setTools={setTools} />} />
          </Routes>
        }
      />
    </BrowserRouter>
  );
}

export default App;
