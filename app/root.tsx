import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Define initEmbeddables function globally but don't auto-execute
              window.initEmbeddables = () => {
                const engineDomain = new URL(window.location.href).searchParams.get('embeddables_engine_domain') || 'engine.embeddables.com'
                const urlRoot = engineDomain.startsWith('http') ? engineDomain : 'https://' + engineDomain
                
                // Remove old bundle script if exists
                const existingScript = document.querySelector('script[src*="bundle.js"]')
                if (existingScript) {
                  existingScript.remove()
                }
                
                // Inject bundle script
                const script = document.createElement('script')
                script.src = \`\${urlRoot}/bundle.js\`
                document.head.appendChild(script)
                
                const initializeEmbeddables = function () {
                  // Check if elements exist before querying
                  const containers = document.querySelectorAll('savvy, embeddable')
                  if (containers.length === 0) {
                    console.warn('[Embeddables] No savvy/embeddable elements found')
                    return
                  }
                  
                  const allUserData = JSON.parse(localStorage.getItem('SavvyFormUserData') || '{}')
                  const embeddablesToLoad = [...containers].map((el) => {
                    const attrs = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]))
                    const flowId = attrs.id
                    if (flowId && allUserData[flowId]) {
                      attrs.userData = Object.fromEntries(Object.entries(allUserData[flowId]||{}).filter(([sk])=>sk==='current_page_id'||sk.startsWith('split_')))
                    }
                    return attrs
                  })
                  const originUrl = window.location.href
                  
                  // Use our proxy API endpoint
                  const loadData = JSON.stringify({ embeddablesToLoad, originUrl })
                  const proxyUrl = '/api/embed-proxy?load=' + encodeURIComponent(loadData) + '&engine_domain=' + encodeURIComponent(engineDomain)
                  
                  const startTime = Date.now()
                  
                  fetch(proxyUrl)
                    .then((res) => res.json())
                    .then((response) => {
                      const loadTime = Date.now() - startTime
                      
                      if (response._cache_meta) {
                        console.log('[Embeddables] Load source:', response._cache_meta.source)
                        console.log('[Embeddables] Load time:', loadTime + 'ms')
                        console.log('[Embeddables] Cached:', response._cache_meta.cached)
                        
                        window._embedCacheMeta = {
                          ...response._cache_meta,
                          loadTime
                        }
                        window.dispatchEvent(new CustomEvent('embed-loaded'))
                      }
                      
                      // Execute embed initialization
                      eval('(' + response.init_js + ')(response.embeddables_data)')
                    })
                    .catch((error) => {
                      console.error('[Embeddables] Load error:', error)
                    })
                }
                
                // Wait for DOM to be ready
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', initializeEmbeddables)
                } else {
                  initializeEmbeddables()
                }
              }
            `,
          }}
        />
      </head>
      <body>
        {children}
        <div 
          id="savvy-container" 
          dangerouslySetInnerHTML={{ 
            __html: '<savvy id="flow_2571d52dhga9i00bfhde72a48gj"></savvy>' 
          }} 
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
