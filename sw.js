/* Sankofa : lecture hors ligne. La page et ses bibliothèques sont gardées après la première visite. */
const V = "sankofa-20261118222253";
const CORE = ["./", "index.html", "404.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "assets/app.390f3f59f2.css", "assets/s1.7d28c4f53c.js", "assets/s2.bc057598e8.js", "assets/s3.7a82afcaa7.js", "assets/s4.359f114c42.js", "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap"];
/* Hors ligne complet : les 42 fiches, les cours et les quiz sont dans ces fichiers ; tout est enregistré dès la première visite. */
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("message", e => { if (e.data === "offline-status") { caches.open(V).then(c => c.keys()).then(ks => { const have = ks.map(k => new URL(k.url).pathname); const ok = CORE.filter(u => u !== "./" && !/^https?:/.test(u)).every(u => have.some(p => p.endsWith(u.replace(/^\.?\//, "")))); e.source && e.source.postMessage({offline: ok, n: ks.length}); }); } });
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  const keep = url.origin === location.origin || /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!keep) return;
  /* Le tableau de bord privé ne passe jamais par le cache */
  if (url.origin === location.origin && (/^\/stats(\.html|\/|$)/.test(url.pathname) || url.pathname === "/version.txt")) return;
  /* La page elle-même : toujours le réseau d'abord, la copie seulement hors ligne */
  if (r.mode === "navigate" || (url.origin === location.origin && /(\/|\.html)$/.test(url.pathname))) {
    e.respondWith(fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, {ignoreSearch:true}).then(h => {
        if (h) return h;
        /* Fiche pays (/colombie/) hors ligne : on ouvre la même fiche dans l'application */
        const m = url.pathname.match(/^\/([a-z0-9-]+)\/?$/);
        if (r.mode === "navigate" && m && !/\./.test(m[1])) return Response.redirect("/#pays-" + m[1], 302);
        return caches.match("./") || caches.match("index.html");
      })));
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => {
      if (res && (res.ok || res.type === "opaque")) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => hit || (r.mode === "navigate" ? caches.match("index.html") : undefined));
    return hit || net;
  }));
});

/* Notifications : nouvelles actualités, nouveaux pays, votes */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {body: e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(d.title || "Sankofa", {body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: d.tag || "sankofa", data: {url: d.url || "/"}}));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(ws => {
    for (const w of ws) { if ("focus" in w) { if ("navigate" in w) w.navigate(url).catch(() => {}); return w.focus(); } }
    return self.clients.openWindow(url);
  }));
});
