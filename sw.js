const CACHE = "nexaindo-shell-v1";
const CORE = ["./","./index.html","./styles.css","./app.js","./config.js","./manifest.webmanifest","./assets/icon.svg"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=="GET" || url.origin!==self.location.origin) return;
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req).then(cached=>cached||caches.match("./index.html"))));
});
