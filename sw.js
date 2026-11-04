// Bihar Swad हिसाब — ऑफ़लाइन कैश (इंटरनेट हो तो हमेशा नया वर्ज़न, न हो तो सेव किया हुआ)
const CACHE="bs-hisaab-v10";
const FILES=["./","./index.html","./app.js","./manifest.json","./icon-192.png","./icon-512.png","./icon-maskable-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:"reload"})))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const same=new URL(e.request.url).origin===location.origin;
  if(same){ // पहले नेटवर्क, फिर कैश
    e.respondWith(fetch(e.request,{cache:"no-cache"}).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return res}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
  }else{
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return res})));
  }
});
