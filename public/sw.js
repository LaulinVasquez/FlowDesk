self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "FlowDesk", {
    body: data.body || "A task needs your attention.",
    tag: data.tag,
    data: { url: data.url || "/app" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => window.url.startsWith(self.location.origin));
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
self.addEventListener("message", event => {
  if (event.data?.type === "FLOWDESK_TEST_NOTIFICATION") event.waitUntil(self.registration.showNotification("FlowDesk", { body: "Notifications are working.", data: { url: "/app" } }));
});
