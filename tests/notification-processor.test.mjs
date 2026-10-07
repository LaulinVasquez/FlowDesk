import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function setEnv(t, key, value) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

// Execute the real TypeScript modules with isolated service dependencies.
function loadModule(path, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

function processor({ tasks = [], subscriptions = [], subscriptionError, configure = () => { throw new Error("Missing VAPID configuration."); } } = {}) {
  const claims = [];
  const removed = [];
  function query(result) {
    const chain = { then: (resolve) => Promise.resolve(result).then(resolve) };
    for (const method of ["select", "eq", "not", "lte", "gte", "single"]) chain[method] = () => chain;
    return chain;
  }
  const supabase = { from(table) {
    if (table === "tasks") return query({ data: tasks });
    if (table === "profiles") return query({ data: { default_reminder_minutes: 60 } });
    if (table === "push_subscriptions") return { ...query({ data: subscriptions, error: subscriptionError }), delete() { removed.push("subscription"); return query({ error: null }); } };
    if (table === "notification_deliveries") return { insert(value) { claims.push(value); return query({ data: { id: "claim" } }); }, delete() { removed.push("claim"); return query({ error: null }); } };
    throw new Error(`Unexpected table: ${table}`);
  } };
  const timing = loadModule("../src/lib/notifications/reminderTiming.ts", {});
  const route = loadModule("../src/app/api/notifications/process/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/supabase/admin": { createAdminClient: () => supabase },
    "@/lib/notifications/push": { configureWebPush: configure },
    "@/lib/notifications/reminderTiming": timing,
  });
  return { run: () => route.GET({ headers: new Headers({ authorization: `Bearer ${process.env.CRON_SECRET}` }) }), claims, removed };
}

const dueTask = () => ({ id: "task", owner_id: "owner", title: "Reminder", due_at: new Date(Date.now() + 30 * 60_000).toISOString(), reminder_minutes: 60 });

test("idle runs do not require VAPID configuration", async (t) => {
  setEnv(t, "CRON_SECRET", "test-secret");
  for (const tasks of [[], [dueTask()], [{ ...dueTask(), due_at: new Date(Date.now() + 120 * 60_000).toISOString() }]]) {
    const result = await processor({ tasks }).run();
    assert.equal(result.status, 200);
    assert.equal(result.body.sent, 0);
  }
});

test("missing VAPID fails before claiming a reminder", async (t) => {
  setEnv(t, "CRON_SECRET", "test-secret");
  const { run, claims } = processor({ tasks: [dueTask()], subscriptions: [{ id: "device" }] });
  assert.equal((await run()).status, 500);
  assert.equal(claims.length, 0);
});

test("configured push sends and records eligible reminders", async (t) => {
  setEnv(t, "CRON_SECRET", "test-secret");
  let configured = 0;
  const sent = [];
  const { run, claims } = processor({ tasks: [dueTask()], subscriptions: [{ id: "one" }, { id: "two" }], configure: () => {
    configured++;
    return { sendNotification: async (...args) => sent.push(args) };
  } });
  assert.deepEqual(await run(), { status: 200, body: { processed: 1, sent: 2 } });
  assert.equal(configured, 1);
  assert.equal(sent.length, 2);
  assert.equal(claims.length, 2);
});

test("missing configuration identifies names without exposing values", (t) => {
  setEnv(t, "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-value");
  setEnv(t, "VAPID_PRIVATE_KEY", "");
  setEnv(t, "VAPID_SUBJECT", "");
  const { configureWebPush } = loadModule("../src/lib/notifications/push.ts", { "web-push": {} });
  assert.throws(configureWebPush, (error) => {
    assert.match(error.message, /VAPID_PRIVATE_KEY, VAPID_SUBJECT/);
    assert.doesNotMatch(error.message, /public-value|NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
    return true;
  });
});

test("push failures report failure and release delivery for retry", async (t) => {
  setEnv(t, "CRON_SECRET", "test-secret");
  const { run, removed } = processor({ tasks: [dueTask()], subscriptions: [{ id: "device" }], configure: () => ({ sendNotification: async () => { throw { statusCode: 403 }; } }) });
  const result = await run();
  assert.equal(result.status, 502);
  assert.equal(result.body.failed, 1);
  assert.deepEqual(removed, ["claim"]);
});

test("expired devices are removed instead of retried forever", async (t) => {
  setEnv(t, "CRON_SECRET", "test-secret");
  const { run, removed } = processor({ tasks: [dueTask()], subscriptions: [{ id: "device" }], configure: () => ({ sendNotification: async () => { throw { statusCode: 410 }; } }) });
  assert.equal((await run()).status, 200);
  assert.deepEqual(removed, ["subscription"]);
});

test("subscription query errors cannot masquerade as successful idle runs", async (t) => {
  setEnv(t, "CRON_SECRET", "test-secret");
  const result = await processor({ tasks: [dueTask()], subscriptionError: { message: "Database error" } }).run();
  assert.equal(result.status, 500);
});

function testPush({ user = { id: "owner" }, subscription = null, configure = () => ({ sendNotification: async () => {} }) } = {}) {
  const filters = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq(key, value) { filters.push([key, value]); return this; }, maybeSingle: async () => ({ data: subscription }) }) }),
  };
  const route = loadModule("../src/app/api/notifications/test/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/notifications/push": { configureWebPush: configure },
  });
  return { filters, run: (origin = "https://flowdesk.example") => route.POST({ headers: new Headers({ origin }), nextUrl: { origin: "https://flowdesk.example" }, json: async () => ({ endpoint: "device-endpoint" }) }) };
}

test("server push test requires same-origin authentication", async () => {
  assert.equal((await testPush().run("https://other.example")).status, 403);
  assert.equal((await testPush({ user: null }).run()).status, 401);
});

test("server push test only sends to the authenticated user's saved subscription", async () => {
  const missing = testPush();
  assert.equal((await missing.run()).status, 404);
  assert.deepEqual(missing.filters, [["user_id", "owner"], ["endpoint", "device-endpoint"]]);
  const sent = [];
  const { run } = testPush({ subscription: { endpoint: "saved-endpoint", p256dh: "saved-key", auth: "saved-auth" }, configure: () => ({ sendNotification: async (...args) => sent.push(args) }) });
  assert.equal((await run()).status, 200);
  assert.equal(sent[0][0].endpoint, "saved-endpoint");
});
