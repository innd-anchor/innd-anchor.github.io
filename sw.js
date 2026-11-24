const CACHE = "innd-anchor-v3";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the app's own files, but never wait long: on a slow connection the saved copy is shown after 2.5 seconds
// (the network answer still updates the saved copy for next time). Requests to other sites (Firebase, Google, Gemini) are never touched.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const net = fetch(req).then((res) => {
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  const cached = () => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
  e.respondWith(
    new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { cached().then((r) => { if (r && !done) { done = true; resolve(r); } }); }, 2500);
      net.then((res) => { if (!done) { done = true; clearTimeout(timer); resolve(res); } },
        () => { clearTimeout(timer); cached().then((r) => { if (!done) { done = true; resolve(r || Response.error()); } }); });
    })
  );
});
