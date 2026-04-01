import { useSearchParams } from "react-router";
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
  const [searchParams] = useSearchParams();

  // Initialize Embeddables when savvy container is ready.
  // Uses URL params if provided, otherwise falls back to defaults (version=latest, hash=landing_main).
  const handleSavvyReady = () => {
    const flowVersion = searchParams.get("savvy_flow_version") || "latest";
    const hash = window.location.hash || "#landing_main";

    // Silently set defaults in URL via replaceState (no redirect/navigation)
    if (!searchParams.has("savvy_flow_version") || !window.location.hash) {
      const newParams = new URLSearchParams(searchParams);
      if (!searchParams.has("savvy_flow_version")) {
        newParams.set("savvy_flow_version", flowVersion);
      }
      window.history.replaceState(null, "", `${window.location.pathname}?${newParams.toString()}${hash}`);
    }

    if (window.initEmbeddables) {
      console.log('[Home] Initializing Embeddables (version:', flowVersion, ', hash:', hash, ')');
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
