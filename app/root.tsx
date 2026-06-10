import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Analytics } from "@vercel/analytics/react";

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
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Set CACHE_DEBUG flag from environment
              window.__CACHE_DEBUG__ = '${import.meta.env.VITE_CACHE_DEBUG || 'false'}';
              
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
                        const meta = response._cache_meta
                        const source = meta.source === 'cache' ? '⚡ CACHE' : '🌐 NATIVE'
                        
                        console.log('[Embeddables] Load source:', source)
                        console.log('[Embeddables] Load time:', loadTime + 'ms')
                        
                        // Log data size (prefer compressed size if available)
                        if (meta.compressed_size_kb && meta.is_compressed) {
                          console.log('[Embeddables] Data size (compressed):', meta.compressed_size_kb + ' KB')
                          console.log('[Embeddables] Data size (uncompressed):', meta.uncompressed_size_kb + ' KB')
                          console.log('[Embeddables] Compression ratio:', meta.compression_ratio?.toFixed(1) + '% saved')
                        } else if (meta.uncompressed_size_kb) {
                          console.log('[Embeddables] Data size:', meta.uncompressed_size_kb + ' KB')
                        } else if (meta.cache_size_kb) {
                          console.log('[Embeddables] Data size:', meta.cache_size_kb + ' KB')
                        }
                        
                        // Log breakdown for native fetches
                        if (meta.source === 'native') {
                          console.log('[Embeddables] Performance breakdown:')
                          console.log('  - Cache check:', meta.cache_check_time + 'ms')
                          console.log('  - API fetch:', meta.api_fetch_time + 'ms')
                          console.log('  - JSON parse:', meta.json_parse_time + 'ms')
                          if (meta.cache_save_time > 0) {
                            console.log('  - Cache save:', meta.cache_save_time + 'ms')
                          }
                          if (meta.network_overhead > 0) {
                            console.log('  - Network overhead:', meta.network_overhead + 'ms')
                          }
                        } else if (meta.source === 'cache') {
                          console.log('[Embeddables] Performance breakdown:')
                          console.log('  - Cache retrieval:', meta.cache_get_time + 'ms')
                          console.log('  - Network time:', meta.network_time + 'ms')
                        }
                        
                        window._embedCacheMeta = {
                          ...meta,
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
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-5Z7G3WZC');`,
          }}
        />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-475155004" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'AW-475155004');`,
          }}
        />
        {/* Heatmap.com */}
        <script
          dangerouslySetInnerHTML={{
            __html: `/* >> Heatmap.com :: Snippet << */(function (h,e,a,t,m,ap) { (h._heatmap_paq = []).push([ 'setTrackerUrl', (h.heatUrl = e) + a]); h.hErrorLogs=h.hErrorLogs || []; ap=t.createElement('script');  ap.src=h.heatUrl+'preprocessor.min.js?sid='+m;  ap.defer=true; t.head.appendChild(ap); ['error', 'unhandledrejection'].forEach(function (ty) {     h.addEventListener(ty, function (et) { h.hErrorLogs.push({ type: ty, event: et }); }); });})(window,'https://dashboard.heatmap.com/','heatmap.php',document,5661);`,
          }}
        />
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5Z7G3WZC"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
        <Analytics />
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
