const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

async function boot() {
  const which = new URLSearchParams(location.search).get('editor') ?? 'codemirror'
  const book = await (await fetch('./book.json')).json()
  const mod = await import(`./${which}.js`)
  const start = performance.now()
  const api = mod.create(document.getElementById('editor'), book)
  await frames()
  window.spike = { ...api, which, loadMs: performance.now() - start, book }
  document.body.dataset.ready = '1'
}
boot()
