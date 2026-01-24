import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
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
  const navigate = useNavigate();

  useEffect(() => {
    // Проверяем наличие обязательных параметров
    const hasVersion = searchParams.has("savvy_flow_version");
    const hasHash = window.location.hash === "#landing_main";

    // Если параметров нет, добавляем их
    if (!hasVersion || !hasHash) {
      const newSearchParams = new URLSearchParams(searchParams);
      
      if (!hasVersion) {
        newSearchParams.set("savvy_flow_version", "latest");
      }

      const newUrl = `?${newSearchParams.toString()}#landing_main`;
      
      // Заменяем URL без перезагрузки страницы
      navigate(newUrl, { replace: true });
    }
  }, [searchParams, navigate]);

  // Initialize Embeddables when savvy container is ready
  const handleSavvyReady = () => {
    const hasVersion = searchParams.has("savvy_flow_version");
    const hasHash = window.location.hash === "#landing_main";

    // Initialize only when required params are present
    if (hasVersion && hasHash) {
      if (window.initEmbeddables) {
        console.log('[Home] Initializing Embeddables after savvy container ready');
        window.initEmbeddables();
      }
    }
  };

  return (
    <main>
      <SavvyContainer onReady={handleSavvyReady} />
      <EmbedCacheDebugPanel />
    </main>
  );
}
