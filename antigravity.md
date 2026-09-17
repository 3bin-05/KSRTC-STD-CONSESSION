# ANAVANDI — Digital Student Concession Pass
### Antigravity build plan (paste one phase at a time)

Run each phase below as its own prompt in Antigravity, in order. Don't skip ahead — later phases assume the data model and design tokens from earlier ones already exist.

---

## Design direction (paste this once, before Phase 0, so the agent locks the visual language)

```
Design direction for this whole project — apply consistently across every screen:

Palette (light theme only, no dark mode needed for the demo):
- Background: warm off-white/cream, #FAF8F5
- Surface (cards, panels): #FFFFFF with a 1px border in #E8E4DC
- Primary accent: warm terracotta/orange, #D97757 — used sparingly, only for primary
  buttons, active nav states, the QR frame, and status highlights. Never as a
  background fill for large areas.
- Text: near-black #1F1E1D for primary text, #6B6862 for secondary/muted text
- Success: muted green #4F7942. Danger/expired: muted brick red #B3492F.
  Keep these desaturated, not neon.

Typography: a clean geometric sans (Inter or system-ui fallback). Sentence case
everywhere — no ALL CAPS labels, no heavy uppercase eyebrow text. Generous
line-height (1.6+) on body copy.

Layout feel: quiet and editorial. Generous whitespace over dense grids. Thin
1px borders instead of drop shadows — if a shadow is unavoidable, keep it under
4% opacity. Rounded corners at 12-16px on cards, 8px on buttons/inputs. No
gradients, no neon glows, no glassmorphism.

Each of the four interfaces (student, institution, admin, conductor) should
feel like a distinct "room" in the same house — same tokens, but the student
app is warm and card-based like a wallet, the institution/admin dashboards are
calmer and table/list-based, and the conductor app is almost entirely one big
scan target with minimal chrome (it needs to be usable in under 5 seconds by
someone standing on a moving bus).

Avoid anything that reads as a generic shadcn/Bootstrap admin template —
no default card grids with icon-in-a-circle stat tiles unless you've made a
deliberate choice about spacing and hierarchy first.
```

---

## Phase 0 — Project scaffold

```
Scaffold a new React + Vite project with Tailwind CSS configured. Set up
React Router with four top-level route groups, each behind its own auth
guard:

- /student/*      — student portal
- /institution/*  — institution dashboard
- /admin/*        — admin dashboard
- /conductor/*    — conductor verifier app (this one should also work as an
                    installable PWA — set up vite-plugin-pwa now, even though
                    the offline logic comes in a later phase)

Set up Firebase (Auth + Firestore only — do NOT use Firebase Storage). Create
a config file for Cloudinary instead: we'll use unsigned upload presets so
file uploads go straight from the browser to Cloudinary without needing a
backend. Leave placeholders for the Cloudinary cloud name and upload preset
in a .env file.

Apply the design direction from the block above as Tailwind theme tokens
(colors, radius, font) so every later phase inherits it automatically.
```

---

## Phase 1 — Auth and roles

```
Build the auth flow using Firebase Auth (email/password + Google sign-in for
students). On first login, create a `users` document in Firestore with a
`role` field: "student" | "institution" | "conductor" | "admin".

Students self-register normally. Institution, conductor, and admin accounts
are NOT self-registrable — they can only be created by an admin (build this
in Phase 5). For now, just build the role-based redirect: after login, route
each user to their correct portal based on `users/{uid}.role`, and block
access to the other three route groups.
```

---

## Phase 2 — Cloudinary upload integration

```
Build a reusable <FileUpload /> component that uploads a file directly to
Cloudinary using an unsigned upload preset (fetch POST to
https://api.cloudinary.com/v1_1/{cloud_name}/upload with the file and
upload_preset in FormData — no API secret in the frontend). Show a progress
indicator, and on success, return the Cloudinary `secure_url` to the parent
component so it can be saved into the relevant Firestore document. Handle
upload failures with a clear inline error, and validate file type
(image/pdf) and a reasonable size limit before uploading.
```

---

## Phase 3 — Student application flow

```
Build the student portal:

1. Application form: name, roll number, institution (dropdown, populated
   from the list of admin-approved institutions — see Phase 5), route
   (from stop, to stop), and the enrolment proof upload (using the
   <FileUpload /> from Phase 2).
2. On submit, create a document in an `applications` collection with
   status "pending_institution".
3. Status screen: show the student their application's current stage —
   pending_institution → pending_admin → approved / rejected — as a
   simple horizontal progress indicator, not a generic badge.
4. Once approved, show the digital pass itself: a wallet-style card with
   the student's name, photo, route, validity window, and a QR code
   (placeholder QR for now — real signing comes in Phase 6). Design this
   card like an actual object worth having, not a form summary.
5. Add a "trip history" tab below the pass — empty state for now, we wire
   real trip data in Phase 8.
6. Add a "renew" button that appears ~2 weeks before the pass's validity
   end date, which pre-fills a new application from the existing one so
   the student only needs to confirm or update details rather than start
   over.
```

---

## Phase 4 — Institution dashboard

```
Build the institution portal. An institution account only sees applications
where `applications.institutionId` matches their own institution.

- List view of pending applications with student name, roll number, route,
  and a link to view the uploaded enrolment proof.
- Approve action: on approve, prompt the institution to set (or confirm a
  default) daily travel distance limit in km for that student, save it to
  the application, and move status to "pending_admin".
- Reject action: move status to "rejected" with an optional reason field
  shown back to the student.
- Keep this screen calm and list-based — a table, not cards, since
  institution staff will be scanning many rows quickly.
```

---

## Phase 5 — Admin dashboard

```
Build the admin portal with three sections:

1. Institution management: add a new institution by name + email domain
   (e.g. "sbce.ac.in"). Only students whose registered email matches an
   approved domain can select that institution on the application form
   in Phase 3 — enforce this check client-side and in Firestore rules.
   Show a list of current approved institutions with a way to
   deactivate one.

2. Conductor management: add a conductor by email — this creates a
   Firebase Auth invite (or a simple admin-set temporary password flow)
   and a `users` document with role "conductor". List existing
   conductors with an active/deactivate toggle.

3. Final pass approval: list of applications with status
   "pending_admin". Approving here is the trigger for Phase 6's signing
   logic — don't build the actual signing yet, just wire the button to
   call a placeholder `issuePass(applicationId)` function and move status
   to "approved".
```

---

## Phase 6 — Signing and the rotating QR pass

```
Implement the actual pass issuance and anti-copy mechanism using
tweetnacl (Ed25519):

1. Generate one Ed25519 keypair for the whole system (do this once,
   store the private key only in a Cloud Function / server-side
   context — never ship it to the frontend — and hardcode the public
   key as a constant in the conductor app).

2. On admin approval (issuePass function from Phase 5), build a payload:
   { studentId, name, photoUrl, route, distanceLimitKm, validFrom,
   validUntil, rotationSeed } — rotationSeed is a random secret generated
   at issuance and stored only in Firestore + the student's own pass, not
   printed anywhere visible.

3. Sign the payload with the private key. Store { payload, signature } in
   a `passes` collection.

4. In the student's pass view (Phase 3), compute a daily rotating code:
   dailyCode = HMAC-SHA256(rotationSeed, today's date string), truncated
   to a short display code. Encode { payload, signature, dailyCode } into
   the QR shown to the student — regenerate it once per day.

5. Build the verify(qrData) function that the conductor app will use:
   check the signature against the public key (proves the pass is
   genuine and untampered), then recompute the expected dailyCode from
   the payload's rotationSeed and today's date and compare — if they
   don't match, the QR is a stale screenshot. Both checks run entirely
   client-side, no network call.
```

---

## Phase 7 — Conductor verifier app

```
Build the /conductor route as an installable PWA that works with no
network connection after first load (cache the app shell with the
service worker from vite-plugin-pwa).

- Opens directly into camera scan mode using html5-qrcode — minimal
  chrome, the scan target should fill most of the screen.
- On scan, run verify(qrData) from Phase 6 entirely offline.
- On success: show a large green confirmation with the student's photo,
  name, route, and today's remaining distance allowance (from the last
  synced value — label it clearly as "as of last sync", don't imply
  real-time certainty).
- On failure (bad signature or stale daily code): large red screen,
  no further detail needed for the conductor.
- On successful verify, let the conductor tap once to log a trip
  (from/to already known from the pass — no typing). Queue this trip
  locally (IndexedDB) if offline, and sync to Firestore's `trips`
  collection whenever connectivity returns.
```

---

## Phase 8 — Trip history and limit sync

```
Wire the student's trip history tab (Phase 3) to a live Firestore listener
on the `trips` collection filtered by their passId, newest first — date,
time, route, and distance for each.

Compute "distance used today" as a sum of today's synced trips, and
surface it both to the student (their own pass view) and to the conductor
app (Phase 7's remaining-allowance display), refreshing whenever a new
trip syncs. If a student would exceed their institution-set daily limit,
show a clear (not alarming) warning on their own pass view rather than
silently blocking anything — the conductor app should just display the
number, not attempt to enforce a hard block on-device.
```