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
  return (
    <main>
    </main>
  );
}
