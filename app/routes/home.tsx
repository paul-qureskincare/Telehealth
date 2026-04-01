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
  // No URL modification — keep the address bar clean.
  const handleSavvyReady = () => {
    if (window.initEmbeddables) {
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
