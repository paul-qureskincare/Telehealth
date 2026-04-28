import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/embed-proxy", "routes/api.embed-proxy.ts"),
  route("api/cache-clear", "routes/api.cache-clear.ts"),
  route("pages/:slug", "routes/pages.$slug.ts"),
] satisfies RouteConfig;
