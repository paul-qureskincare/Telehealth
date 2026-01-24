import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { EmbedCacheDebugPanel } from "../components/EmbedCacheDebugPanel";

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

  // Initialize Embeddables after React hydration
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window === 'undefined') return;

    const hasVersion = searchParams.has("savvy_flow_version");
    const hasHash = window.location.hash === "#landing_main";

    // Initialize only when required params are present
    if (hasVersion && hasHash) {
      // Small delay to ensure DOM is fully ready after hydration
      const timer = setTimeout(() => {
        if (window.initEmbeddables) {
          console.log('[Home] Initializing Embeddables after React hydration');
          window.initEmbeddables();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <main>
      <EmbedCacheDebugPanel />
    </main>
  );
}
