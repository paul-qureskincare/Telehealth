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
              window.initEmbeddables = () => {
                const engineDomain = new URL(window.location.href).searchParams.get('embeddables_engine_domain') || 'engine.embeddables.com'
                const urlRoot = engineDomain.startsWith('http') ? engineDomain : 'https://' + engineDomain
                
                // Удаляем старый скрипт, если он уже был загружен
                const existingScript = document.querySelector('script[src*="bundle.js"]')
                if (existingScript) {
                  existingScript.remove()
                }
                
                const script = document.createElement('script')
                script.src = \`\${urlRoot}/bundle.js\`
                document.head.appendChild(script)
                
                const initializeEmbeddables = function () {
                  const allUserData = JSON.parse(localStorage.getItem('SavvyFormUserData') || '{}')
                  const embeddablesToLoad = [...document.querySelectorAll('savvy, embeddable')].map((el) => {
                    const attrs = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]))
                    const flowId = attrs.id
                    if (flowId && allUserData[flowId]) {
                      attrs.userData = Object.fromEntries(Object.entries(allUserData[flowId]||{}).filter(([sk])=>sk==='current_page_id'||sk.startsWith('split_')))
                    }
                    return attrs
                  })
                  const originUrl = window.location.href
                  const loadParam = JSON.stringify({ embeddablesToLoad, originUrl })
                  const primaryFlowId = embeddablesToLoad[0]?.id || ''
                  const proxyUrl = new URL('/api/embed-proxy', window.location.origin)
                  proxyUrl.searchParams.set('load', loadParam)
                  if (primaryFlowId) {
                    proxyUrl.searchParams.set('flowId', primaryFlowId)
                  }
                  proxyUrl.searchParams.set('engineDomain', engineDomain)
                  
                  // Функция для отображения плашки статуса кэша
                  function showCacheIndicator(fromCache) {
                    console.log('🎯 Showing cache indicator:', fromCache ? 'FROM CACHE ✓' : 'NEW FETCH ⚡')
                    const indicator = document.createElement('div')
                    indicator.id = 'embed-cache-indicator'
                    indicator.style.cssText = \`
                      position: fixed;
                      top: 20px;
                      right: 20px;
                      padding: 12px 16px;
                      border-radius: 6px;
                      font-size: 14px;
                      font-weight: 500;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      z-index: 10000;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                      animation: slideIn 0.3s ease-out;
                    \`
                    
                    if (fromCache) {
                      indicator.innerHTML = '✓ Контент загружен из кэша'
                      indicator.style.backgroundColor = '#10b981'
                      indicator.style.color = '#ffffff'
                    } else {
                      indicator.innerHTML = '⚡ Первая загрузка (кэш заполняется...)'
                      indicator.style.backgroundColor = '#f59e0b'
                      indicator.style.color = '#ffffff'
                    }
                    
                    document.body.appendChild(indicator)
                    console.log('📍 Indicator appended to DOM')
                    
                    // Добавляем стиль для анимации
                    if (!document.getElementById('cache-indicator-styles')) {
                      const style = document.createElement('style')
                      style.id = 'cache-indicator-styles'
                      style.innerHTML = \`
                        @keyframes slideIn {
                          from {
                            opacity: 0;
                            transform: translateX(20px);
                          }
                          to {
                            opacity: 1;
                            transform: translateX(0);
                          }
                        }
                      \`
                      document.head.appendChild(style)
                    }
                    
                    // Удаляем плашку через 6 секунд
                    setTimeout(() => {
                      console.log('👋 Hiding indicator')
                      indicator.style.transition = 'opacity 0.3s ease-out'
                      indicator.style.opacity = '0'
                      setTimeout(() => indicator.remove(), 300)
                    }, 6000)
                  }
                  
                  fetch(proxyUrl.toString())
                    .then((res) => res.json())
                    .then((response) => {
                      if (response._cacheStatus) {
                        showCacheIndicator(response._cacheStatus.fromCache)
                      }
                      eval('(' + response.init_js + ')(response.embeddables_data)')
                    })
                }
                
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', initializeEmbeddables)
                } else {
                  initializeEmbeddables()
                }
              }
              
              // Проверяем наличие обязательных параметров перед инициализацией
              const urlParams = new URLSearchParams(window.location.search)
              const hasRequiredParams = urlParams.has('savvy_flow_version') && window.location.hash === '#landing_main'
              
              // Инициализируем только если параметры уже есть
              if (hasRequiredParams) {
                window.initEmbeddables()
              }
            `,
          }}
        />
      </head>
      <body>
        <savvy id="flow_2571d52dhga9i00bfhde72a48gj"></savvy>
        {children}
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
