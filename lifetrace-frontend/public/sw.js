// 开发环境：直接透传所有请求，不做任何缓存，避免 ServiceWorker 缓存旧代码干扰开发
// 生产环境：cache-first 静态资源，network-first API
const CACHE_NAME = "lifetrace-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/logo.png"];
const IS_DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

// Install: cache static assets (仅生产)
self.addEventListener("install", (event) => {
	if (IS_DEV) {
		self.skipWaiting();
		return;
	}
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(STATIC_ASSETS);
		})(),
	);
	self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			// 开发环境：清掉所有缓存，确保拿到最新代码
			const toDelete = IS_DEV ? keys : keys.filter((key) => key !== CACHE_NAME);
			await Promise.all(toDelete.map((key) => caches.delete(key)));
		})(),
	);
	self.clients.claim();
});

// Fetch: 开发环境全部走网络（passthrough），生产环境按资源类型分流
self.addEventListener("fetch", (event) => {
	if (IS_DEV) {
		// 开发环境不拦截，让浏览器正常请求 dev server
		return;
	}

	const { request } = event;
	const url = new URL(request.url);

	// API calls: network first, fallback to cache
	if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/opencode/")) {
		event.respondWith(networkFirst(request));
		return;
	}

	// Static assets & page: cache first, network fallback
	event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response("Offline", { status: 503 });
	}
}

async function networkFirst(request) {
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(CACHE_NAME);
			// Cache API only supports GET requests — don't cache mutations
			if (request.method === "GET") {
				cache.put(request, response.clone());
			}
		}
		return response;
	} catch {
		const cached = await caches.match(request);
		if (cached) return cached;
		return new Response(JSON.stringify({ error: "Offline" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		});
	}
}
