1. У нас есть JavaScript код embed:

<script>
window.initEmbeddables = () => {
  // Get the engine domain from the URL parameters
  const engineDomain =
    new URL(window.location.href).searchParams.get('embeddables_engine_domain') ||
    'engine.embeddables.com'
  const urlRoot = engineDomain.startsWith('http') ? engineDomain : 'https://' + engineDomain

  // Inject the bundle script dynamically
  const script = document.createElement('script')
  script.src = `${urlRoot}/bundle.js`
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
    const url =
      `${urlRoot}/init?load=` +
      encodeURIComponent(JSON.stringify({ embeddablesToLoad, originUrl }))

    fetch(url)
      .then((res) => res.json())
      .then((response) => eval('(' + response.init_js + ')(response.embeddables_data)'))
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEmbeddables)
  } else {
    initializeEmbeddables()
  }
}
window.initEmbeddables()
</script>


2. У нас есть контейнер, куда этот embed вставляет свой исполняемый код:

<savvy id="flow_2571d52dhga9i00bfhde72a48gj"></savvy>