import React, { useState, useEffect } from "react";
import { ZorveusProvider, OAuthCallbackHandler } from "@zorveus/react";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./components/LandingPage";
import { CreatePage } from "./components/CreatePage";

function getInitialPath(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname.toLowerCase();
  if (path === "/create" || path.startsWith("/create/")) {
    return "/create";
  }
  return "/";
}

export default function App(): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);

  // Sync client-side route with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getInitialPath());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const clientId = env.VITE_ZORVEUS_CLIENT_ID || "";
  const inferenceKey = env.VITE_ZORVEUS_INFERENCE_KEY || env.VITE_ZORVEUS_API_KEY || undefined;
  const apiUrl = (env.VITE_ZORVEUS_API_URL || "https://api.zorveus.com").replace(/\/+$/, "");
  const gatewayBaseURL = env.VITE_ZORVEUS_GATEWAY_URL || `${apiUrl}/v1`;
  const redirectUri = env.VITE_ZORVEUS_REDIRECT_URI || "http://localhost:5173/oauth/callback";

  return (
    <ZorveusProvider
      clientId={clientId}
      inferenceKey={inferenceKey}
      redirectUri={redirectUri}
      baseURL={apiUrl}
      gatewayBaseURL={gatewayBaseURL}
      persistToken={true}
    >
      <OAuthCallbackHandler
        onSuccess={() => {
          if (typeof window !== "undefined" && !window.opener) {
            window.location.replace("/");
          }
        }}
      />

      {/* Global Minimalist SaaS Navbar */}
      <Navbar currentPath={currentPath} onNavigate={navigateTo} />

      {/* Page Routing: Landing (/) vs Creation Studio (/create) */}
      <main>
        {currentPath === "/create" ? (
          <CreatePage />
        ) : (
          <LandingPage onStartWriting={() => navigateTo("/create")} />
        )}
      </main>
    </ZorveusProvider>
  );
}
