// ارفع الرقم عند كل نشر: يُحذف التخزين المؤقت القديم وتُخزَّن الملفات من جديد.
// أبقِ البادئة 'calorie-': التخزين المؤقت مشترك بين كل مشاريع username.github.io،
// ولا نحذف إلا ما يبدأ بها حتى لا نمس كاش مشروع آخر
const CACHE_PREFIX = 'calorie-';
const CACHE_VERSION = 'calorie-v2';

// المسارات نسبية لمكان sw.js، فتعمل داخل مجلد فرعي على GitHub Pages
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // no-cache: نتجاوز ذاكرة المتصفح العادية حتى لا نخزّن نسخة قديمة
      .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// حفظ نسخة من الرد دون تأخير الصفحة؛ waitUntil يُبقي الـ worker حياً حتى تنتهي الكتابة
function store(event, key, res) {
  const copy = res.clone();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.put(key, copy)).catch(() => { /* لا شيء: النسخة الحالية تبقى */ })
  );
}

// نبحث في كاش هذا التطبيق فقط، لا في كاشات مشاريع أخرى على الأصل نفسه
function fromCache(key) {
  return caches.open(CACHE_VERSION).then(c => c.match(key));
}

// مسار صفحة التطبيق: مجلد sw.js نفسه أو index.html داخله
const APP_PATH = new URL('./', self.location).pathname;
function isAppPage(url) {
  const path = new URL(url).pathname;
  return path === APP_PATH || path === APP_PATH + 'index.html';
}

// الشبكة أولاً: مع الإنترنت تظهر أحدث نسخة دائماً، والمخزّن يُستخدم فقط دون إنترنت
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      // redirect: 'manual': إن وُجد تحويل يتولاه المتصفح بنفسه (رد محوَّل يُرفض للتنقل)
      fetch(req.url, { cache: 'no-cache', redirect: 'manual' })
        .then(res => {
          // نحفظ صفحة التطبيق فقط (HTML من مسارها)، حتى لا يصير ملف أو صفحة أخرى هي «index.html»
          const type = (res.headers.get('content-type') || '').toLowerCase();
          if (res.status === 200 && type.includes('text/html') && isAppPage(req.url)) store(event, './index.html', res);
          return res;
        })
        .catch(() => fromCache('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.status === 200) store(event, req, res);
        return res;
      })
      .catch(() => fromCache(req))
  );
});
