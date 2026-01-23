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
    // Always ensure we have the required parameters
    const hasVersion = searchParams.has("savvy_flow_version");
    const currentHash = window.location.hash;

    // If parameters are missing or hash is missing, set them
    if (!hasVersion || currentHash !== "#landing_main") {
      const newSearchParams = new URLSearchParams(searchParams);
      
      if (!hasVersion) {
        newSearchParams.set("savvy_flow_version", "latest");
      }

      // Use window.history to set URL with hash since navigate() doesn't handle hashes well
      const newUrl = `/?${newSearchParams.toString()}#landing_main`;
      window.history.replaceState(null, "", newUrl);
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
