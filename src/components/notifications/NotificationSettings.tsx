"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { getDefaultReminder, removePushSubscription, savePushSubscription, setDefaultReminder } from "@/services/pushSubscriptionService";

type State = "loading" | "unsupported" | "default" | "granted" | "denied";
const decodeKey = (value: string) => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

export function NotificationSettings() {
  const [state, setState] = useState<State>("loading");
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [minutes, setMinutes] = useState<15 | 60 | 1440>(60);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("unsupported"); return; }
    setState(Notification.permission as Exclude<State, "loading" | "unsupported">);
    Promise.all([navigator.serviceWorker.register("/sw.js"), getDefaultReminder()]).then(async ([registration, preference]) => {
      setMinutes(preference); setEnabled(!!(await registration.pushManager.getSubscription()));
    }).catch(() => setMessage("FlowDesk couldn't load notification settings."));
  }, []);
  const enable = async () => {
    setPending(true); setMessage("");
    try {
      const permission = await Notification.requestPermission(); setState(permission);
      if (permission !== "granted") { setMessage(permission === "denied" ? "Notifications are blocked in your browser." : "Notification permission was not granted."); return; }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
      await savePushSubscription(subscription); setEnabled(true); setMessage("Browser notifications enabled.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "FlowDesk couldn't enable notifications."); }
    finally { setPending(false); }
  };
  const disable = async () => {
    setPending(true); setMessage("");
    try { const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription(); if (subscription) { await removePushSubscription(subscription.endpoint); await subscription.unsubscribe(); } setEnabled(false); setMessage("Notifications disabled on this browser."); }
    catch { setMessage("FlowDesk couldn't disable notifications."); } finally { setPending(false); }
  };
  const updateMinutes = async (value: 15 | 60 | 1440) => { setMinutes(value); try { await setDefaultReminder(value); setMessage("Default reminder updated."); } catch { setMessage("FlowDesk couldn't update the reminder preference."); } };
  const test = async () => { const registration = await navigator.serviceWorker.ready; registration.active?.postMessage({ type: "FLOWDESK_TEST_NOTIFICATION" }); };
  return <div className="notification-settings">
    <div className="settings-card"><div><strong>Browser notifications</strong><p>{state === "unsupported" ? "Notifications are not supported by this browser." : enabled ? "Enabled on this browser." : state === "denied" ? "Blocked in browser settings." : "Receive reminders when FlowDesk is not active."}</p></div><button className="btn secondary" disabled={pending || state === "unsupported" || state === "denied"} onClick={enabled ? disable : enable}>{pending ? <Loader2 className="spin"/> : enabled ? <BellOff/> : <Bell/>}{enabled ? "Disable" : "Enable notifications"}</button></div>
    <div className="settings-card"><div><strong>Default push reminder</strong><p>Used when a task inherits your default.</p></div><select value={minutes} onChange={event => updateMinutes(Number(event.target.value) as 15 | 60 | 1440)} disabled={state === "unsupported"}><option value={15}>15 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></div>
    {process.env.NODE_ENV === "development" && enabled && <div className="settings-card"><div><strong>Test notification</strong><p>Display a notification from the registered service worker.</p></div><button className="btn secondary" onClick={test}><Send/>Send test</button></div>}
    {message && <p className="notification-message" role="status">{message}</p>}
  </div>;
}
