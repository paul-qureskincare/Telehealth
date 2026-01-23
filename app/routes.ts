import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("api/embed-proxy", "routes/api.embed-proxy.ts"),
  index("routes/home.tsx"),
] satisfies RouteConfig;
