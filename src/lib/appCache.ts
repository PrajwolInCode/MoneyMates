export async function clearMoneyMatesAppCache() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name.startsWith("moneymates-")).map((name) => caches.delete(name)));
  }
}

export async function clearMoneyMatesAppCacheAndReload() {
  await clearMoneyMatesAppCache();
  const url = new URL(window.location.href);
  url.searchParams.set("app_refresh", String(Date.now()));
  window.location.replace(url.toString());
}

export async function clearLocalAppCacheAndReload() {
  await clearMoneyMatesAppCacheAndReload();
}
