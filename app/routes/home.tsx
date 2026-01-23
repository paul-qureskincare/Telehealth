import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/home";

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
      
      // Переинициализируем Embed после изменения URL
      setTimeout(() => {
        if (window.initEmbeddables) {
          window.initEmbeddables();
        }
      }, 100);
    }
  }, [searchParams, navigate]);

  return (
    <main>
    </main>
  );
}

// Расширяем тип Window для TypeScript
declare global {
  interface Window {
    initEmbeddables?: () => void;
  }
}
