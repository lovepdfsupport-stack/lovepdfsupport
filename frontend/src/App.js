import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home';
import ToolPage from './pages/ToolPage';
import SignPage from './pages/SignPage';
import EditPdfPage from './pages/EditPdfPage';
import ImageToolPage from './pages/ImageToolPage';

if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tool/sign-pdf" element={<SignPage />} />
            <Route path="/tool/edit-pdf" element={<EditPdfPage />} />
            <Route path="/tool/compress-image" element={<ImageToolPage />} />
            <Route path="/tool/crop-image" element={<ImageToolPage />} />
            <Route path="/tool/remove-background" element={<ImageToolPage />} />
            <Route path="/tool/photo-text" element={<ImageToolPage />} />
            <Route path="/tool/:slug" element={<ToolPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
