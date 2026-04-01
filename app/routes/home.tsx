import type { Route } from "./+types/home";
import { EmbedCacheDebugPanel } from "../components/EmbedCacheDebugPanel";
import { SavvyContainer } from "../components/SavvyContainer";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Telehealth — Qure Skincare" },
    {
      name: "description",
      content: "Simple placeholder for the Telehealth service.",
    },
  ];
}

export default function Home() {
  // Initialize Embeddables when savvy container is ready.
  // Falls back to defaults if URL params are missing — no redirect needed.
  const handleSavvyReady = () => {
    if (window.initEmbeddables) {
      // Ensure required params exist for Embeddables engine
      const url = new URL(window.location.href);
      if (!url.searchParams.has("savvy_flow_version")) {
        url.searchParams.set("savvy_flow_version", "latest");
      }
      if (!url.hash) {
        url.hash = "landing_main";
      }
      // Silently update URL without triggering React Router navigation
      window.history.replaceState(null, "", url.toString());

      console.log('[Home] Initializing Embeddables');
      window.initEmbeddables();
    }
  };

  return (
    <main>
      <SavvyContainer onReady={handleSavvyReady} />
      <EmbedCacheDebugPanel />
    </main>
  );
}
