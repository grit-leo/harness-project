import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import App from "./App.tsx";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { DiscoveryPage } from "./pages/DiscoveryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PublicCollectionPage } from "./pages/PublicCollectionPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/c/:token" element={<PublicCollectionPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<App />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/discover" element={<DiscoveryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
