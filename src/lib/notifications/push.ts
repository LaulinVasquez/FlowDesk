import webpush from "web-push";

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const missing = [
    !publicKey && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    !privateKey && "VAPID_PRIVATE_KEY",
    !subject && "VAPID_SUBJECT",
  ].filter(Boolean);
  if (!publicKey || !privateKey || !subject) throw new Error(`Missing VAPID configuration: ${missing.join(", ")}. Configure these variables in the deployment environment and redeploy.`);
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}
