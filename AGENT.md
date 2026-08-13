# FlowDesk Agent Task — Authentication Foundation + Simple Home Page

## Goal

Finish the current Supabase authentication foundation and create a very simple public landing page for FlowDesk.

Do not expand into task/database persistence yet beyond the user profile foundation described below.

## Current State

The following are already working:

* Next.js App Router
* Supabase browser client
* Supabase cookie-aware server client
* Google OAuth
* `/auth/callback`
* PKCE code exchange
* Supabase session persistence
* Authenticated user can be retrieved with `supabase.auth.getUser()`

Preserve the existing working authentication flow.

---

## 1. Create the `profiles` Table

Add a Supabase migration for:

```text
profiles
```

Required columns:

* `id` — UUID primary key referencing `auth.users.id`
* `full_name` — text
* `avatar_url` — text, nullable
* `created_at` — timestamptz
* `updated_at` — timestamptz

The authenticated user's email should continue to come from Supabase Auth and does not need to be duplicated unless required by the existing application.

### Security

Enable Row-Level Security.

A signed-in user must only be able to:

* Read their own profile
* Insert their own profile
* Update their own profile

Use `auth.uid()` in the policies.

Do not use a service-role key in the frontend.

---

## 2. Automatically Create or Update the Profile

After a successful Google authentication, ensure a `profiles` record exists for the authenticated user.

Use Google/Supabase metadata where available:

* `full_name`
* `avatar_url`

The implementation should safely upsert the profile using the authenticated Supabase user ID.

Do not trust a user ID supplied manually by the browser when the authenticated session can provide it.

---

## 3. Create a Simple Public Landing Page

Change `/` into a very simple FlowDesk landing page.

The landing page should be intentionally minimal.

Suggested content:

```text
FlowDesk

Organize your tasks.
Focus on what matters.

[Continue with Google]
```

The page should visually match the existing FlowDesk design language.

Requirements:

* Clean
* Minimal
* Responsive
* Dark/light theme compatible if the application already supports themes
* No large marketing sections
* No pricing
* No testimonials
* No feature grid
* No unnecessary animations

This is only a temporary/simple home page.

---

## 4. Authentication Behavior

### Unauthenticated user

Visiting:

```text
/
```

should show the landing page and Google login button.

### Authenticated user

If the user is already authenticated and visits `/`, redirect them to the existing FlowDesk application/dashboard.

Use an appropriate authenticated route for the existing application.

If the current application is still rendered directly from `/`, move it to a reasonable authenticated route such as:

```text
/app
```

or:

```text
/dashboard
```

Prefer `/app` if no routing convention already exists.

Do not rewrite the existing Todo application.

---

## 5. Login Page

The existing `/login` page may remain, but simplify and polish it if necessary.

Both:

```text
/
```

and:

```text
/login
```

may provide Google authentication.

Avoid duplicating authentication logic unnecessarily. Extract a reusable Google login button/component if appropriate.

Example structure:

```text
src/components/auth/
    GoogleSignInButton.tsx
```

---

## 6. Authenticated User UI

Replace the currently hardcoded FlowDesk user information where practical with the authenticated Google user/profile.

Use:

* Google name
* Google avatar
* Authenticated email

Do not redesign the sidebar or settings UI.

Only replace the hardcoded data source.

---

## 7. Logout

Ensure the existing authenticated interface has a working logout action.

Logout should:

1. Call Supabase `signOut()`
2. Clear the authenticated session
3. Redirect the user to `/`

---

## 8. Preserve Existing Application

Do not modify or redesign:

* Task system
* Projects
* Search
* AI search
* Filters
* Task modals
* Theme system
* Existing visual components

Do not migrate tasks or projects to Supabase during this task.

Current `localStorage` behavior should remain untouched for now.

---

## 9. Clean Up Temporary Authentication Debugging

Remove temporary authentication debugging once login is verified.

This includes things such as:

```text
/supabase-test
```

and temporary OAuth `console.log` statements.

Keep meaningful error handling.

---

## 10. Verification

Before considering the task complete, verify:

* Google login works
* OAuth callback succeeds
* Session persists after refresh
* `/` shows the landing page when logged out
* Logged-in users are redirected to the FlowDesk app
* Authenticated Google name/avatar/email are displayed where appropriate
* Profile row is created in Supabase
* User can only access their own profile through RLS
* Logout works
* Refresh after logout does not restore the old session
* Existing tasks/projects continue working as before
* `npm run lint` passes
* TypeScript validation passes
* Production build passes

## Important

Keep this milestone small.

The purpose is only to leave FlowDesk with a clean authentication foundation and simple public entry point.

Do **not** begin task or project persistence yet.
