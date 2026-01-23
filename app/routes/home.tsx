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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-16">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
        Telehealth
      </span>
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
        Telehealth Service is under development
      </h1>
      <p className="text-base text-gray-600 dark:text-gray-400">
        A simple and convenient online service for consultations and support will appear here soon.
      </p>
      <p className="text-sm text-gray-500">
        This is currently a placeholder for the future home page.
      </p>
    </main>
  );
}
