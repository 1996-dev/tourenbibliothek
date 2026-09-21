/* Service Worker der Tourenbibliothek.
   Zweck: die Seite am Berg ohne Netz benutzbar halten.

   Strategie fuer die eigenen Dateien: erst aus dem Cache ausliefern (sofort da,
   auch bei schlechtem Empfang), im Hintergrund nachladen. Eine Aenderung ist
   also beim uebernaechsten Start sichtbar, nicht sofort - der Preis dafuer,
   dass es ohne Netz zuverlaessig laeuft.

   Schriften von Google Fonts werden beim ersten Start mit Netz mitgenommen,
   damit die Seite offline gleich aussieht. Ohne sie greift der Schriftstapel
   des Systems, die Seite bleibt vollstaendig benutzbar.

   VERSION setzt build.py aus dem Inhalt der Seite - neuer Inhalt, neuer Cache. */

const VERSION = "tourenbib-2026-09-21-99b4b1ba73";
const SCHRIFT_CACHE = "tourenbib-schriften-v1";

const SCHALE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

const SCHRIFT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(VERSION)
      // einzeln, damit eine fehlende Datei nicht die ganze Installation kippt
      .then((c) => Promise.all(SCHALE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n !== VERSION && n !== SCHRIFT_CACHE)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  /* Schriften: einmal geholt, bleiben sie liegen. */
  if (SCHRIFT_HOSTS.indexOf(url.hostname) !== -1) {
    ev.respondWith(
      caches.open(SCHRIFT_CACHE).then((c) =>
        c.match(req).then((treffer) =>
          treffer || fetch(req).then((antw) => {
            if (antw && (antw.ok || antw.type === "opaque")) c.put(req, antw.clone());
            return antw;
          }).catch(() => treffer)
        )
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* Seitenaufruf: Cache zuerst, Nachladen im Hintergrund. Ohne Netz und ohne
     passenden Treffer faellt alles auf die Startseite zurueck. */
  ev.respondWith(
    caches.open(VERSION).then((c) =>
      c.match(req, { ignoreSearch: true }).then((treffer) => {
        const frisch = fetch(req).then((antw) => {
          if (antw && antw.ok) c.put(req, antw.clone());
          return antw;
        }).catch(() => null);
        return treffer || frisch.then((a) =>
          a || (req.mode === "navigate" ? c.match("./index.html") : Response.error())
        );
      })
    )
  );
});
