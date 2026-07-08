# Astral Web — API Contract Reference

This doc is the source of truth for what `astral-api` expects and returns
on every auth endpoint — use it to verify or adjust your existing
register/login/reset-password pages against the real contract. Read it
alongside `instructions.txt` (covers the WhatsApp-side flow: wa.me links,
DM triggers).

Base URL (dev): `http://localhost:4000`
Base URL (prod): your deployed Railway URL for `astral-api` (e.g.
`https://astral-api-production.up.railway.app`) — confirm the current one
with Abhijit, it may change as deploys move around. Must match `WEB_ORIGIN`
configured on the API side exactly, or CORS will reject every request.

**Every request that touches auth must send `credentials: "include"`**
(fetch) or `withCredentials: true` (axios). Auth is entirely via httpOnly
cookies — there is no token to store in JS, localStorage, or a header.
This is deliberate: it's the standard defense against XSS stealing
sessions, and it means you never touch the token directly.

---

## 1. Registration page — `/register?token=xxx`

### How the user gets here
They never type this URL manually. They:
1. Are in a WhatsApp group, run `.register`
2. Bot DMs them a link like `https://astral.app/register?token=a1b2c3...`
3. They tap it, land here with the token in the query string

(Side note, not something you need to build anything for: the bot now
treats ANY DM as a trigger — the "register"/"recover" prefilled text in
the wa.me link is just a friendly hint for the user, not something the
bot parses. Doesn't change anything about your pages.)

### Fields this endpoint expects
Exactly three, per the product spec — check your existing form sends
these:
- **Phone number** — use a proper phone input component (e.g.
  `react-phone-number-input`) so it outputs E.164 format automatically
  (`+14155551234`). Don't hand-roll phone validation.
- **Password** — min 8 characters (enforce client-side for UX, but the
  API re-validates regardless — never trust client validation alone)
- **Age** — number input, 13–120

Read `token` from the URL on page load. If it's missing entirely, don't
even show the form — show the "no token" state below immediately.

### Request
```
POST /auth/register
Content-Type: application/json

{
  "token": "a1b2c3...",       // from the URL
  "phone": "+14155551234",
  "password": "user-typed-password",
  "age": 21,
  "deviceFingerprint": "optional-hash-if-you-add-fingerprinting"
}
```

### Success response — `201`
```json
{ "handle": "player123456#4821", "age": 21 }
```
Cookies are set automatically by the response (`Set-Cookie` headers) — you
don't read or store anything from the body except to show a welcome
screen. Redirect to a logged-in landing page / dashboard.

### Error responses — build a UI state for EACH of these
All errors follow this shape:
```json
{ "error": { "code": "...", "message": "human-readable string" } }
```

| `code` | HTTP | When | UI you should show |
|---|---|---|---|
| `validation_error` | 400 | Malformed phone/password/age | Inline field errors — the response includes an `issues` array with `path`/`message` per field, map these to the right input |
| `invalid_token` | 400 | No token in URL, or token doesn't exist | **Full-page state**: "This registration link isn't valid. Go back to WhatsApp and run `.register` again." — don't show the form at all |
| `token_expired` | 400 | Token existed but expired (10 min TTL) | Same full-page state as above, different copy: "This link expired. Run `.register` again in WhatsApp to get a new one." |
| `token_used` | 400 | Someone already used this exact link | "This link was already used. If that wasn't you, run `.register` again for a new link." |
| `already_registered` | 409 | This WhatsApp account already has a web account | "You already have an account — try logging in instead" + link to `/login` |
| `phone_in_use` | 409 | Someone else already registered with this phone | Inline error under phone field: "This phone number is already registered." Don't say anything more specific — that's intentional, don't ask me to change it |
| `handle_generation_failed` | 500 | Rare — internal collision retry exhausted | Generic "something went wrong, try again" |

**Important UX point:** `invalid_token`, `token_expired`, and someone
bookmarking `/register` with no token at all are the SAME conceptual dead
end — the user has no valid path forward on this page. Build one shared
"go back to WhatsApp" component for all three rather than three different
screens.

---

## 2. Login page — `/login`

### Fields
- Phone number (same E.164 component as registration)
- Password
- "Remember me" checkbox (affects session length — unchecked means the
  session dies when the browser closes, checked means ~30 days)

### Request
```
POST /auth/login
Content-Type: application/json

{
  "phone": "+14155551234",
  "password": "...",
  "rememberMe": true
}
```

### Success — `200`
```json
{ "handle": "player123456#4821" }
```
Redirect to dashboard.

### Errors
| `code` | HTTP | UI |
|---|---|---|
| `validation_error` | 400 | Inline field errors |
| `invalid_credentials` | 401 | Generic "invalid phone or password" — **deliberately vague**, don't ask the API to say which one is wrong, that's a security decision not a bug |
| `account_locked` | 423 | "Too many failed attempts — try again in N minutes" (message includes the actual wait time, just display it) |

Add a "Forgot password?" link → sends them to WhatsApp (see next section),
not to a page on your site.

---

## 3. Forgot password flow

This does NOT start on your webapp with a form. It starts in WhatsApp:

1. Your "Forgot password?" link/button opens
   `https://wa.me/<BOT_NUMBER>?text=recover` (confirm exact number/prefill
   text with the bot dev — don't hardcode a guess)
2. User taps it, sends the prefilled message to the bot
3. Bot DMs them back a link like `https://astral.app/reset-password?token=xxx`
4. They land on YOUR `/reset-password?token=xxx` page

**No OTP anywhere in this flow** — it's magic-link only. Possession of the
link is the entire proof; there's no code to type in.

### What this page needs
Just a "set new password" form (new password + confirm field). Read
`token` from the URL on load. If it's missing entirely, show the same
"go back to WhatsApp" dead-end state used on registration rather than
showing a form that can't succeed.

### Request
```
POST /auth/reset-password
Content-Type: application/json

{
  "token": "xxx",             // from the URL
  "newPassword": "new-password-here"
}
```

### Success — `200`
```json
{ "ok": true }
```
This also logs the user out everywhere (security measure) — redirect to
`/login` with a "Password changed — please log in" message, don't try to
auto-login them.

### Errors
| `code` | HTTP | UI |
|---|---|---|
| `validation_error` | 400 | Inline errors |
| `invalid_token` | 400 | "This reset link isn't valid — request a new one via WhatsApp" — dead-end, "go back to WhatsApp" component |
| `token_used` | 400 | "This link was already used" — same dead-end component |
| `token_expired` | 400 | "This link expired — request a new one via WhatsApp" — same dead-end component |
| `account_not_found` | 404 | Rare edge case — generic error, dead-end |

---

## 4. Session handling (applies to every authenticated page)

- On app load, call `GET /me` to check if the user has a valid session.
  - `200` → they're logged in, use the returned `handle`/`age`/
    `phoneVerified` to populate the UI
  - `401` → not logged in, show logged-out nav / redirect protected pages
    to `/login`
- Access tokens expire in 15 minutes. If any authenticated API call
  returns `401 invalid_token`, call `POST /auth/refresh` once and retry
  the original request. If refresh ALSO fails, treat as fully logged out
  → redirect to `/login`. Don't loop this — one retry only.
- `POST /auth/logout` clears everything — call this on your logout
  button, then redirect to `/`.

Build this refresh-and-retry as a shared fetch wrapper/interceptor rather
than repeating it per API call — you'll be calling authenticated
endpoints constantly once the actual game features (cards, trades, etc.)
get their own API routes later.

---

## 5. Things NOT built yet — don't block on these

- Handle/username picking UI (registration auto-generates a placeholder
  handle like `player123456#4821` — a "customize your handle" step is a
  future onboarding screen, not part of registration itself)
- Live stats counters (needs a public stats endpoint — doesn't exist yet)
- Card browsing / inventory / trading UI (separate API routes, not built)
- Email — there is no email anywhere in this system, everything is
  phone + WhatsApp based, don't add an email field anywhere

If you hit an endpoint or error code not listed here, stop and ask rather
than guessing the shape — the backend and bot are both still evolving and
guessing wrong here means a broken form for real users.
