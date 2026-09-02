import webpush from "web-push";

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("Missing VAPID configuration.");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}
