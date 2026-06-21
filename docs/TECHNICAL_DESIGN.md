# Host Hours — Technical Design & Requirements

**Status:** Living document · **Audience:** Anyone building Host Hours from scratch on any stack
**Purpose:** This is a *requirements specification*, not a description of the current implementation. It captures **what the product must do** and **the rules it must enforce**, deliberately separated from *how* the existing Next.js + Supabase build does it. You should be able to hand this to a fresh team — or rebuild on Convex, Firebase, Rails, etc. — and produce an equivalent product without reading the old code.

Where a rule exists only because of a quirk of the current stack (e.g. Postgres Row-Level Security), it is called out as an **implementation note** so you can drop it. The access-control model is described as *intent* ("a manager may read logs on assigned properties"), which you implement however your backend prefers.

> **Building on Convex?** Read [§16 Building on Convex](#16-building-on-convex) last — it maps every entity and rule below onto Convex tables, functions, file storage, and HTTP actions, and explains why several of the current system's hardest workarounds disappear entirely.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Personas & Roles](#2-personas--roles)
3. [Glossary](#3-glossary)
4. [Domain Model (Entities)](#4-domain-model-entities)
5. [Roles & Access Control](#5-roles--access-control)
6. [Authentication & Onboarding](#6-authentication--onboarding)
7. [Team, Invitations & Ownership Transfer](#7-team-invitations--ownership-transfer)
8. [Properties](#8-properties)
9. [Task Types](#9-task-types)
10. [Time Tracking — Live Timer & Manual Logging](#10-time-tracking--live-timer--manual-logging)
11. [Dashboard & Activity](#11-dashboard--activity)
12. [Photos & Receipts](#12-photos--receipts)
13. [Reports, Tax Logic & Exports](#13-reports-tax-logic--exports)
14. [Billing & Subscriptions](#14-billing--subscriptions)
15. [Geolocation & Auto-Timer](#15-geolocation--auto-timer)
16. [Building on Convex](#16-building-on-convex)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Out of Scope / Future](#18-out-of-scope--future)
19. [Appendix A — Enumerations & Constants](#appendix-a--enumerations--constants)
20. [Appendix B — Cross-Cutting Business Rules](#appendix-b--cross-cutting-business-rules)

---

## 1. Product Overview

**Host Hours** is a meticulous time-tracker for **short-term-rental (STR) hosts** (Airbnb / VRBO operators). Its central job is to let hosts **prove material participation** in their rental activity to the IRS by capturing *who did what work, where, for how long, and with what evidence* — then export that record as a defensible tax report.

### The problem it solves

Under U.S. tax law, whether STR income is treated as active vs. passive (and whether losses are deductible against ordinary income) often hinges on the host meeting an IRS **material-participation test** — most commonly logging **500+ hours/year** on the activity, or **100+ hours with no one participating more**, or performing **substantially all** of the work. Hosts who don't keep contemporaneous records lose these arguments in audits. Host Hours is the contemporaneous record.

### What the product does

- Lets a host define their **properties** and the **types of work** they do.
- Captures time two ways: a **live timer** (start on arrival, stop on departure) and **manual entries** (after-the-fact logging).
- Records, per entry, whether the work was done **on-site** (physically at the property) vs. remote — relevant to participation arguments.
- Lets hosts attach **photo evidence / receipts** to entries.
- Allows a **married couple** to combine their hours (a spouse's participation counts toward the same activity for the material-participation tests).
- Lets a host build a **team** (managers, helpers/cleaners) and see their hours — while keeping team hours **separate** from the owner's material-participation total (paid help does *not* count toward the host's own participation).
- Tracks progress toward an **annual goal / chosen IRS test** with live KPI bars.
- **Exports** a polished **tax PDF** (per-person logs, per-property breakdowns, embedded receipts) and a **CSV** report by email.
- Is a **PWA** — installable, works offline for viewing.
- Is monetized via **subscription tiers** (free / professional / enterprise) gated on property count and features.

### Design tenets

1. **Evidence-grade records.** Every hour should be defensible: timestamped, attributed to a person, tied to a property, optionally on-site, optionally with a photo.
2. **Couples are first-class.** Spouse hours combine seamlessly; this is a core differentiator, not an add-on.
3. **Paid help never inflates the host's participation.** Team hours are tracked and reported, but walled off from the material-participation total.
4. **Mobile-first, low-friction capture.** Arriving at a property should make starting a timer one tap; the app is location-aware.
5. **The host owns their data and can walk away with a clean export.**

---

## 2. Personas & Roles

There are four logical roles. Exactly one is the account principal (**Owner**); the others exist as **team memberships** attached to an owner's account.

| Role | UI label | Who they are | Tax relevance |
|---|---|---|---|
| **Owner** | "Owner" | The account holder. Owns properties, billing, and the team. | Their hours are the baseline material-participation total. |
| **Spouse** | "Spouse Co-Owner" | The owner's married partner. Co-manages everything. | **Hours combine** with the owner's for material-participation tests. |
| **Manager** | "Manager" (or a custom label) | Trusted staff who can log hours and view reports for properties they're assigned. | Tracked but **not** combined; no participation test of their own. |
| **Helper** | "Helper" (or a custom label, e.g. "Cleaner") | Cleaners, handymen, etc. Log their own hours on assigned properties. | Tracked but **not** combined; no participation test of their own. |

Key distinctions:

- **Owner is implicit** — it is the account, not a stored "team member" row. (When ownership is transferred, the previous owner *becomes* a Spouse membership under the new owner; see §7.)
- **Spouse is a co-owner in everything but billing** — full read/write on properties, logs, reports, and team; the only fixed-label role.
- **Manager vs. Helper** differ mainly in read access: a Manager can *read* logs and reports on assigned properties and manage lower roles; a Helper can essentially only *write their own* logs on assigned properties.
- **Display name ≠ permission.** Managers and Helpers carry an optional **display role** (free text like "Cleaner", "Property Manager", "Handyman") shown throughout the UI, while their *permissions* come from the underlying role. Spouse and Owner have fixed labels and cannot be relabeled.

The exhaustive capability matrix is in [§5](#5-roles--access-control).

---

## 3. Glossary

- **Property** — a rental unit the host tracks hours against. Has a location for geofencing.
- **Time Log / Entry** — one recorded block of work: person + property + task + start + duration (+ on-site flag, notes, photos).
- **Active Timer** — an in-progress, not-yet-saved time log. At most one per user. Becomes a Time Log when stopped.
- **Task Type** — a user-defined category of work ("Cleaning", "Guest Communications"). Used as quick-pick pills; the chosen name is copied onto the entry as free text.
- **On-site** — the work was performed physically at the property (vs. remote, e.g. answering guest messages from home).
- **Material participation** — the IRS concept of being sufficiently involved in an activity; the product helps hosts meet one of its tests.
- **Target test** — the specific IRS test the host is aiming to satisfy (500-hour / 100-hour / substantially-all).
- **Annual goal** — the host's target hours for the year (drives the progress bar). Defaults to the test's threshold.
- **Combined hours** — owner + spouse hours summed (only spouses combine).
- **Team** — the set of memberships (spouse/manager/helper) under one owner.
- **Invitation** — a tokenized email link that lets an invitee join a team and create/connect their account.
- **Property assignment** — the link granting a manager/helper access to a specific property.
- **Subscription tier** — the billing plan (free/professional/enterprise) that gates property count and features.

---

## 4. Domain Model (Entities)

Types are given abstractly (`string`, `int`, `timestamp`, `uuid`, `enum`, `string[]`). Adapt to your backend. "Owned by" relationships use the account principal's user id. **Soft delete** means a `deletedAt` timestamp that hides the row from normal reads while retaining it for audit/history.

### 4.1 User / Profile

The human account. (Authentication identity may live in a separate auth system; the **Profile** is the app-level record.)

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | ✓ | — | Same id as the auth identity. |
| `email` | string | ✓ | — | Login identity. |
| `fullName` | string | | — | Display name. |
| `avatarUrl` | string | | — | Optional. |
| `timezone` | string | ✓ | `America/New_York` | All "day" bucketing is in the user's local time. |
| `taxYear` | int | ✓ | current year | The year reports/goals default to. Multi-year supported. |
| `targetTest` | enum | ✓ | `500` | One of `500` \| `100` \| `substantially`. (Ignored for staff.) |
| `goalHours` | int | ✓ | `500` | Annual goal. (Staff: treated as `100`; see §13.) |
| `createdAt` / `updatedAt` | timestamp | ✓ | now | |

**On account creation, the system must bootstrap:** (a) a Profile, (b) a default set of **Task Types** (see [Appendix A](#appendix-a--enumerations--constants)), and (c) a **free Subscription**. (See §6.)

### 4.2 Subscription & Subscription Tier

**SubscriptionTier** (catalog; seeded, read-only to clients):

| Field | Type | Notes |
|---|---|---|
| `id` | string | `free` \| `professional` \| `enterprise`. |
| `displayName` | string | |
| `maxProperties` | int \| null | `free`=1, `professional`=5, `enterprise`=null (unlimited). |
| `hasLiveTimer` | bool | Feature flag. |
| `hasCsvExport` | bool | Feature flag. |
| `hasGeoAutostart` | bool | Feature flag (gates the native auto-timer). |
| `hasTeamMembers` | bool | Feature flag (gates team management). |
| `monthlyPriceCents` / `yearlyPriceCents` | int | `professional` ≈ $19.99/mo, $191.90/yr; `enterprise` ≈ $49.99/mo, $479.90/yr; `free` = 0. |
| `stripeMonthlyPriceId` / `stripeYearlyPriceId` | string | Payment-provider price handles. |
| `isActive` | bool | Hide retired tiers. |
| `sortOrder` | int | Display order. |

**Subscription** (one per user):

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `userId` | uuid | **Unique** — one subscription per user. |
| `tierId` | string | FK → tier. |
| `paymentCustomerId` / `paymentSubscriptionId` / `paymentPriceId` | string | Provider handles. |
| `status` | enum | `trialing` \| `active` \| `incomplete` \| `incomplete_expired` \| `past_due` \| `canceled` \| `unpaid` \| `paused`. |
| `currentPeriodStart` / `currentPeriodEnd` | timestamp | Billing window. |
| `cancelAtPeriodEnd` | bool | |
| `trialEnd` / `canceledAt` | timestamp | |

### 4.3 Property

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | ✓ | — | |
| `userId` | uuid | ✓ | — | Owner (account principal). |
| `name` | string | ✓ | — | |
| `address` | string | | — | Shown in tax reports (preferred over name). |
| `description` | string | | — | |
| `color` | string (hex) | ✓ | `#4A148C` | UI color dot. |
| `latitude` / `longitude` | float | | — | For geofencing; optional. |
| `geoRadiusMeters` | int | ✓ | `500` | On-site / arrival radius. |
| `tags` | string[] | ✓ | `[]` | Free-form labels; used for filtering. |
| `isArchived` / `archivedAt` | bool / ts | ✓ / — | `false` | Hidden from active lists, data retained. |
| `deletedAt` | timestamp | | — | **Soft delete.** Hidden unless it still has logged activity. |
| `createdAt` / `updatedAt` | timestamp | ✓ | now | |

### 4.4 Task Type

Per-user, private quick-pick categories.

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | uuid | ✓ | |
| `userId` | uuid | ✓ | **Unique on `(userId, name)`.** |
| `name` | string | ✓ | |
| `sortOrder` | int | ✓ | Manual ordering. |

> **Important design point:** Task Types are *pickers only*. When chosen, the **name is copied** onto the Time Log as free text — there is **no foreign key** from a log to a task type. This means deleting a task type never orphans history, and users may type ad-hoc task names that aren't in their list. (See §9.)

### 4.5 Time Log (Entry)

The core record.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | ✓ | — | |
| `userId` | uuid | ✓ | — | Who performed the work. |
| `propertyId` | uuid | ✓ | — | |
| `title` | string | ✓ | — | The task name (free text, copied from a Task Type or typed). |
| `description` | string | | — | Notes. |
| `category` | string | ✓ | `other` | Normalized slug of the task(s) (e.g. `booking_mgmt`); not used for querying, retained for grouping/back-compat. |
| `startedAt` | timestamp | ✓ | — | |
| `endedAt` | timestamp | | — | Nullable (timer entries compute duration on stop). |
| `durationSecs` | int | ✓ | `0` | Authoritative duration. |
| `isBillable` | bool | ✓ | `true` | |
| `isOnsite` | bool | ✓ | `false` | On-site vs. remote. |
| `source` | string | ✓ | `manual` | `manual` \| `timer` \| `web` \| (future `auto`). |
| `deletedAt` | timestamp | | — | **Soft delete.** |
| `createdAt` / `updatedAt` | timestamp | ✓ | now | |

### 4.6 Active Timer

An in-progress entry. **At most one per user** (enforced as a uniqueness constraint).

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | ✓ | — | |
| `userId` | uuid | ✓ | — | **Unique.** |
| `propertyId` | uuid | ✓ | — | |
| `title` | string | ✓ | — | Task name. |
| `description` | string | | — | |
| `category` | string | ✓ | `other` | |
| `isBillable` | bool | ✓ | `true` | |
| `isOnsite` | bool | ✓ | `false` | Editable while running. |
| `startedAt` | timestamp | ✓ | now | |
| `source` | string | ✓ | `web` | |

**Stopping a timer** must atomically: compute `durationSecs = now − startedAt`, create a Time Log carrying over all fields (incl. `isOnsite`), and delete the Active Timer. This must be safe against concurrent double-stops (lock/transaction).

### 4.7 Team Member (Membership)

A spouse/manager/helper relationship under one owner. (Owner is **not** represented here.)

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | ✓ | — | |
| `ownerId` | uuid | ✓ | — | The team's owner. |
| `memberId` | uuid | | — | The member's user id; **null while pending** (not yet accepted). |
| `email` | string | ✓ | — | Lowercased. Invitation target; unique per owner. |
| `firstName` / `lastName` | string | | — | For display. |
| `role` | enum | ✓ | — | `spouse` \| `manager` \| `employee`. (`employee` = "Helper".) |
| `displayRole` | string | | — | Custom UI label (manager/helper only; **null for spouse**). |
| `status` | enum | ✓ | `pending` | `pending` \| `active` \| `suspended`. |
| `autoTimerEnabled` | bool | ✓ | `false` | Native geofence config (see §15). |
| `defaultTask` | string | | — | Task the auto-timer would log. |
| `invitedAt` / `joinedAt` | timestamp | ✓ / — | now / — | `joinedAt` set when accepted. |

> **"Helper" is the role `employee`.** The product never shows the word "employee" — the UI label is **Helper**. Keep the internal value or rename it; just preserve the label mapping.

### 4.8 Property Assignment

Grants a manager/helper access to one property.

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | uuid | ✓ | |
| `teamMemberId` | uuid | ✓ | **Unique on `(teamMemberId, propertyId)`.** |
| `propertyId` | uuid | ✓ | |

Spouses need **no** assignments — they implicitly access **all** of the owner's properties.

### 4.9 Invitation

A tokenized join link.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | ✓ | — | |
| `teamMemberId` | uuid | ✓ | — | The pending membership it activates. |
| `token` | uuid/opaque | ✓ | random | **Unique.** Possession of the token = proof of email control (it's delivered to the invitee's inbox). |
| `expiresAt` | timestamp | ✓ | +7 days | |
| `usedAt` | timestamp | | — | Set on acceptance. |

### 4.10 Time Log Photo

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | uuid | ✓ | |
| `timeLogId` | uuid | ✓ | Cascade-deletes with the log. |
| `userId` | uuid | ✓ | Uploader. |
| `storagePath` | string | ✓ | Path in private object storage. A sibling thumbnail lives at a derived path. |
| `fileName` | string | ✓ | |
| `contentType` | string | | |
| `fileSize` | int | | |

### 4.11 Webhook Event (payment idempotency ledger)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `providerEventId` | string | **Unique** — idempotency key. |
| `eventType` | string | |
| `payload` | json | |
| `status` | enum | `pending` \| `processing` \| `processed` \| `failed`. |
| `processedAt` / `error` | ts / string | |

### 4.12 Relationships (summary)

```
Profile (user) 1───* Property
Profile         1───* TaskType
Profile         1───* TimeLog ───* TimeLogPhoto
Profile         1───0..1 ActiveTimer
Profile         1───1 Subscription ───* SubscriptionTier (catalog)
Property        1───* TimeLog
Property        1───* PropertyAssignment
Profile(owner)  1───* TeamMember(member) ───* PropertyAssignment
TeamMember      1───* Invitation
```

> **Note on "spouse links":** the current build still contains a legacy `spouse_links` table from an earlier design; it has been fully superseded by `TeamMember` rows with `role = spouse`. **A greenfield build does not need it** — model spouses purely as team memberships.

---

## 5. Roles & Access Control

This section is the **authorization specification**. Implement it however your backend does access control. The current build expresses some of it as database Row-Level Security and some as in-code checks (see the implementation note at the end); **a fresh build should implement all of it as code-level authorization in the server functions** — it is simpler and avoids the bugs the current build hit.

### 5.1 Capability matrix

Capabilities are scoped: **"own"** = rows where the actor is the worker; **"team (assigned)"** = rows on properties the actor is assigned to; **"team (all)"** = all rows under the owner.

| Capability | Owner | Spouse | Manager | Helper |
|---|---|---|---|---|
| Read/write **own** time logs | ✓ | ✓ | ✓ | ✓ |
| Read **properties** | all | all | assigned | assigned |
| Create/edit/archive/delete **properties** | ✓ | ✓ | ✗ | ✗ |
| Read **others'** time logs | team (all) | team (all) | team (assigned) | ✗ |
| View **reports** (My Hours, Activity) | ✓ | ✓ | ✓ (own) | ✗ (own only, no report tabs) |
| View **Team** tab (per-member hours) | ✓ | ✓ | ✗ | ✗ |
| View **combined** owner+spouse reports | ✓ | ✓ | ✗ | ✗ |
| **Export** (tax PDF / CSV) | ✓ | ✓ | ✗ | ✗ |
| **Manage team** (invite/edit/remove) | spouse, mgr, helper | spouse, mgr, helper | mgr, helper only | ✗ |
| **Billing** | ✓ | ✗ | ✗ | ✗ |
| Configure **own** auto-timer preference | ✓ | ✓ | ✓ | ✓ |
| **Transfer ownership** | ✓ | ✗ | ✗ | ✗ |

### 5.2 Role-management rules

- **Manageable roles:** Owner & Spouse can manage **all** roles (spouse, manager, helper). A Manager can manage **only** managers and helpers — never a spouse or the owner. A Helper manages no one.
- **One spouse per owner.** The system must reject inviting/promoting a second spouse.
- **Owner is unremovable.** No team action may delete the owner from their own team.
- **Spouse is fixed-label.** A spouse has no `displayRole`; UI always shows "Spouse Co-Owner".
- **Display role applies to manager/helper only**, and falls back to the role's default label when empty.

### 5.3 What each role *sees* in the app

- **Owner / Spouse:** everything — dashboard, all properties, full reports incl. **Team** and **Export** tabs, team management, settings, billing (owner only for billing actions).
- **Manager:** dashboard + assigned properties + their **own** "My Hours" and "Activity"; can manage managers/helpers; **no** Team tab, **no** Export, **no** material-participation target test.
- **Helper:** dashboard + assigned properties + their **own** "My Hours" and "Activity"; **no** team UI at all, **no** Export, **no** target test.

### 5.4 Combined-hours visibility (the spouse rule)

When an owner has an **active spouse**, the two people's hours are a single material-participation pool:

- **Reports** offer a "combine" toggle (on by default conceptually); **tax PDF/CSV always combine** owner+spouse when a spouse exists, regardless of the on-screen toggle.
- Each person's detailed activity stays in **separate** tables/sections (you can tell who did what), but totals and KPIs sum them.
- **Manager/Helper hours are never part of this pool** — they're reported separately and explicitly labeled "not combined".

### 5.5 The "authorize in code" principle

The single most important access-control lesson from the current build, stated as a requirement:

> **All cross-account access (a spouse or manager acting on the owner's data) must be authorized by an explicit server-side check that verifies the full tuple `(ownerId, actingUserId, role, status=active)` before any read or write — and the operation must then run with privileges sufficient to actually complete it.**

In the current build this is the "authorize with the service role" pattern: verify the membership in code, then use a privileged DB client so that partial RLS rules don't silently return zero rows. A greenfield build with code-level authorization gets this for free — there is no second, conflicting policy layer to fight. The *requirement* is simply: **never rely on an implicit ambient policy to scope team access; check it explicitly and fail loudly.**

> **Implementation note (current stack only):** The existing app uses Postgres RLS for single-user data and then *bypasses* RLS (service-role client) for all team/spouse/manager operations because RLS policies for the many-to-many spouse relationship repeatedly returned empty results (a silent denial reads as "no data", which looked like data-loss bugs). On a backend where authorization is plain code (e.g. Convex), **do not port the RLS policies** — implement §5.1 directly in your query/mutation functions and delete the dual-layer complexity.

---

## 6. Authentication & Onboarding

### 6.1 Sign-up / sign-in

- **Methods:** email + password, and Google OAuth. (Add others as desired.)
- **Password:** minimum 8 characters.
- **Sessions:** standard secure, server-validated sessions. Always validate the session against the auth backend on protected requests (don't trust an unverified cookie).
- **Public routes:** landing, login, sign-up, password reset, the auth callback, and the **invitation** route. Everything else requires a session; unauthenticated access redirects to login preserving the intended destination.
- **Password-reset edge case:** an expired reset link must land on a friendly "link expired" screen, not a raw error.

### 6.2 Account bootstrap (must happen exactly once per new user)

On first creation of a user, atomically provision:

1. A **Profile** (id, email, name, default timezone, default tax settings).
2. The **default Task Types** ([Appendix A](#appendix-a--enumerations--constants)).
3. A **free Subscription** (`tierId = free`, `status = active`).

A brand-new account with no properties and no activity sees an **onboarding** state (not an empty dashboard): "Add your first property", "Set your tax goal", and a 3-step explainer. **A new account must show no "recent properties"** (nothing has activity yet).

### 6.3 Invitation → sign-up → acceptance

This flow lets an invitee create a **pre-confirmed** account (no separate email-verification step) because the invitation token was already delivered to their inbox — possession of it proves they control the address.

**Stages:**

1. **Invite created** (by owner/spouse/manager): a `pending` TeamMember + an Invitation token (7-day expiry) are created and an email is sent containing a link to the invitation route with the token.
2. **Invitee opens the link (unauthenticated):** the page fetches **public-but-tokenized** invitation info — `{ email, firstName, lastName, ownerName }` — to personalize the screen ("Join {ownerName}'s team") and **prefill** the sign-up form. The email and name come from the **token**, never from client input (anti-spoofing).
3. **Invitee creates an account from the invitation:** the server validates the token, takes the email **from the token**, and creates a **pre-confirmed** user (skip email verification). Then the client signs in and proceeds to acceptance. *(If they already have an account, they sign in instead and skip to acceptance.)*
4. **Acceptance:** with the invitee signed in, the server validates the token (exists, not expired, not used) and checks **email match** between the signed-in user and the invited email:
   - **Match →** set `memberId`, `status = active`, `joinedAt = now`; mark the invitation used; done.
   - **Mismatch →** return a distinct **"wrong account"** result (`invitedEmail`, `currentEmail`) so the UI can offer "sign in as {invitedEmail}" instead of showing a scary error.
   - **Already used by *this* user →** treat as success (idempotent).
   - **Already used by someone else / expired / invalid →** clear, friendly error ("ask your team owner to resend").

**Resend:** owner/spouse/manager can resend; resending **invalidates prior tokens** (delete old, issue fresh, re-email). Only the newest link works.

> Requirement: acceptance and the pre-confirmed sign-up must work **before** the invitee has any normal data-access rights — i.e. the server reads/writes the invitation and membership with elevated privilege, scoped strictly to the token. (See §5.5.)

---

## 7. Team, Invitations & Ownership Transfer

All team operations enforce §5.1–5.2 (manageable roles, one-spouse, owner-unremovable) and the §5.5 authorize-in-code principle. The acting user may be the **owner** or an **active spouse/manager** of the team; managers are additionally restricted to targets that are managers/helpers.

**Operations the product must support:**

| Operation | Inputs | Rules / Effects |
|---|---|---|
| **Invite member** | email, role, assigned propertyIds, first/last name, displayRole, autoTimer, defaultTask | Reject self-invite, duplicate email on team, or a 2nd spouse. Manager may invite only manager/helper. Creates pending membership + assignments + invitation; sends email. |
| **Accept invitation** | token | See §6.3. |
| **Sign up from invitation** | token, name, password | Pre-confirmed account; email from token. |
| **Get invitation info** | token | Public (tokenized) `{email, names, ownerName}` for prefill. |
| **Update role** | memberId, role, displayRole | Enforce one-spouse; clear displayRole if spouse. Manager can't set spouse. |
| **Update name** | memberId, first, last | |
| **Update email** | memberId, email | Unique on team; **resets membership to pending** and clears `memberId` (the new address must re-accept). |
| **Update property assignments** | memberId, propertyIds | Replace the assignment set. |
| **Remove member** | memberId, keepHours? | If `keepHours` and the member had joined, **reassign their time logs on the owner's properties to the owner** (preserve hours for tax/payroll), then delete the membership (+ assignments). If the removed member is a **spouse**, also remove the **reciprocal** spouse membership (spouse links are bidirectional). Never remove the owner. |
| **Resend invitation** | memberId | Only for `pending`. Invalidate old tokens; issue + email a new one. |
| **Read team roster** | ownerId | Returns owner profile + all memberships with names, roles, status, assigned propertyIds, and the caller's own role. Must batch lookups (no N+1). |
| **Read team hours** | ownerId | Map of `userId → totalSeconds` across all logs on the owner's properties (powers the Team tab). |
| **Read entry photos (team)** | ownerId, entryIds | Signed/served photo URLs for entries on the owner's properties (so a spouse's photos appear in the owner's combined PDF). Scope strictly to the owner's properties. |
| **Get/set my auto-timer** | — / (enabled, defaultTask) | A member edits **their own** membership prefs; applies across every team they're on. |
| **Transfer ownership** | newOwnerId | Owner-only. `newOwnerId` must be an **active spouse**. Atomically: remove the new owner's membership, re-point all remaining memberships to the new owner, add the **old** owner as a spouse under the new owner, and transfer property ownership. |

**Roster display rules (Team management screen):** sort as **Spouse Co-Owner first, then Managers (by last name), then Helpers (by last name)**; fold the current viewer into the list with a subtle "(you)" tag; the viewer may edit only their own name inline. Helpers never see this screen. Managers see it but can only act on managers/helpers.

---

## 8. Properties

**CRUD:**

- **Create:** name (required), optional address/description, color (default plum `#4A148C`), optional lat/long, `geoRadiusMeters` (default 500), tags. **Creation is gated by the subscription's `maxProperties`** — block and prompt to upgrade when the active-property count is at the tier limit (free=1, pro=5, enterprise=∞). See §14.
- **Edit:** any of the above. Owner and **spouse** may edit; manager/helper may not.
- **Archive:** `isArchived = true` (+ `archivedAt`) — hides from active pickers but keeps everything. Reversible.
- **Delete:** **soft delete** (`deletedAt`). Hidden from normal lists and pickers, **but** a soft-deleted property still appears (read-only) in the Properties list **if it has logged activity**, so historical reports remain coherent. Logs are never silently destroyed by deleting a property.

**List view:** color dot, name, address (if any), tags, status badge ("Deleted"); active rows expose "Edit / Start timer / Log hours"; tag filter; counts ("X active, Y deleted").

**Color & tags** are organizational aids; tags are free-form `string[]` used for filtering.

---

## 9. Task Types

- **Per-user, private** quick-pick categories, seeded with a default set on signup ([Appendix A](#appendix-a--enumerations--constants)).
- Rendered as **pills** in the timer and log forms. Single-select in manual logging; the timer uses one task per session.
- **Editable inline:** add (`+Add` → text → enter), delete (× in edit mode), reorder. `(userId, name)` is unique.
- **Free-text copy onto entries:** selecting a pill copies its **name** into `TimeLog.title`; a normalized slug goes into `category` (e.g. "Booking Mgmt" → `booking_mgmt`; multiple → comma-joined). **No FK** — deleting a task type never alters past entries, and users may enter custom task names not in their list.

---

## 10. Time Tracking — Live Timer & Manual Logging

Two capture paths produce the same `TimeLog` records.

### 10.1 Live timer

- **One active timer per user** (hard constraint). Starting a second prompts to stop/replace the current one.
- **Start:** choose property (often pre-selected via a deep link from the dashboard/property list) and a task pill → creates an Active Timer (`startedAt = now`). The timer can be deep-linked to auto-start a given task.
- **On-site default:** on start, the app checks geolocation (foreground) and sets `isOnsite = (device within the property's `geoRadiusMeters`)`. The user can toggle on-site while running. If geolocation is denied/unavailable, default to **remote** (`false`).
- **Persistence:** an Active Timer survives reloads — on load, restore from the stored record and recompute elapsed = `now − startedAt`. The running timer is the **first tile** on the dashboard (live `HH:MM:SS`, property, task, Stop, "Add details").
- **Stop:** atomically convert to a Time Log (see §4.6) and show an **after-stop edit card** for the just-saved entry (task, duration, on-site toggle, notes, photos, "Done").
- **Duration formatting:** under 1 hour show minutes (`48m`, and `1m` as the floor for any non-zero sub-minute), otherwise decimal hours (`1.3h`). The same formatter drives "TODAY total".
- **Photos:** disabled while running; available on the after-stop card (cap 10, see §12).

### 10.2 Manual logging

A form for after-the-fact entry:

- **Property** (required).
- **Date** (required; defaults today).
- **Duration** — either a **time range** (start + end → computed duration; this wins if both are present) **or** a **manual decimal** hours field.
- **Task** (required; one pill, or typed).
- **On-site** toggle (defaults on).
- **Notes** (optional → `description`).
- **Photos** (optional, ≤10).

**Validation:** property chosen; duration > 0; at least one task; if using a range, end > start. On submit, create the Time Log (compute `startedAt`/`endedAt`/`durationSecs`), upload any photos, then return to dashboard. Surface validation/DB errors inline.

### 10.3 Editing entries & the grouped editor

The dashboard/activity views **group** entries by `(task title, local day, property)` and render each group as an expandable card. The **grouped editor** must support:

- Editing **each session's** start time and duration within the group.
- Editing **group-level** shared fields: the **date** (moves the whole group), on-site, notes, and photos (photos attach to the representative/most-recent session).
- **Cross-midnight handling:** if an edited end time is earlier than the start, treat it as next-day (add 24h) rather than producing a negative/zero duration. *(A real bug the current build fixed: setting a start after the end silently floored the duration to "1m".)*
- **Auto-save** edits.

---

## 11. Dashboard & Activity

The dashboard is the home screen and is location-aware. Required modules, in priority order:

1. **Active timer tile** (if a timer is running) — see §10.1.
2. **"You are at {Property}"** — for each property within geofence range *right now*, a card with inline task pills (and quick `+Add`) to **one-tap start** a timer there. Shown only when idle.
3. **Recent properties** — up to **3** properties that **have logged activity**, most-recent first, each with "Start timer" / "Log hours". (Hidden when a "you are at" card is showing.) A brand-new user sees none.
4. **Recent activity** — entries from the last **14 days**, grouped (§10.3), showing day label ("Today"/"Yesterday"/weekday/date), time, task, property (+ session count if >1), and total duration; expandable to the grouped editor; "All →" links to full reports when there are more.
5. **Onboarding** (only when zero properties and zero activity) — see §6.2.

Header: time-of-day greeting + first name + initials avatar (→ settings), and the current weekday/date.

---

## 12. Photos & Receipts

Photos are **evidence** attached to time logs (receipts, before/after shots). Requirements:

- **Cap: 10 photos per entry**, enforced both in the UI and server-side (count existing before accepting new).
- **Client-side downscale before upload:** convert any image to JPEG, longest side ≤ **1280px**, quality ~0.8 ("full"), and also generate a **thumbnail** (longest side ≤ **400px**, quality ~0.65). Fill transparency with a white matte (avoid black JPEG backgrounds). Non-image files (e.g. PDFs) pass through unchanged. Never upload a "shrunk" file that's larger than the original.
- **Storage:** **private** object storage, namespaced per user (`{userId}/{timeLogId}/{uuid}.jpg`) with a sibling `{...}_thumb.jpg`. Deleting a photo deletes both variants and the metadata row. Photos cascade-delete with their entry.
- **Serving (cacheable, authorized):** serve photos through a **stable per-photo URL** that (a) authorizes the requester and (b) sets long-lived **private** cache headers (e.g. `private, max-age=86400, immutable`) — rather than minting short-lived signed URLs that defeat caching. A `?thumb=1` variant serves the thumbnail (falling back to full if absent).
- **Team visibility:** when an owner/spouse generates a **combined** report, photos uploaded by the *spouse* must be retrievable by the *owner* (and vice-versa). The server-side team-photo accessor (see §7) must produce URLs for entries on the owner's properties even though the requester isn't the uploader — scoped strictly to that owner's properties.

### 12.1 Recommended implementation — Cloudflare R2 (or any S3-compatible store)

Receipts are the app's **cost driver** (≤10/entry, persisted for years, re-served constantly for thumbnails and embedded into tax PDFs). The recommended object store is **Cloudflare R2** because it is **S3-compatible** (no lock-in; portable to S3/Backblaze later) and charges **$0 for egress** — the one cost that otherwise grows unbounded for a media-heavy app. This decouples photo cost from whichever app backend you choose and keeps it flat (~$3–5/mo at 1000 users; the free tier of 10 GB + 1M writes + 10M reads/mo typically covers year one).

**This is a drop-in for the §12 requirements, not a redesign** — the client already resizes (so R2's lack of server-side image transforms is irrelevant) and serving already goes through a proxy (so a private bucket fits). Only the storage client changes.

**Object layout.** Bucket is **private** (never public). Object keys mirror the existing scheme; store the key in `timeLogPhotos.storagePath`:
- Full: `{userId}/{timeLogId}/{uuid}.jpg`
- Thumbnail: `{userId}/{timeLogId}/{uuid}_thumb.jpg`

**Upload (presigned PUT — keeps blobs off your server).**
1. Client resizes the file into two blobs (full ≤1280px, thumb ≤400px).
2. Client calls a server function `requestPhotoUpload(timeLogId)` → server **authorizes** (requester owns the log, or is an owner/spouse/assigned-manager with write access to that property) and **enforces the ≤10 cap** by counting existing rows, then returns two short-TTL **presigned PUT URLs** (one per key).
3. Client `PUT`s both blobs directly to R2 (requires bucket **CORS** allowing `PUT` from your origin).
4. Client calls `confirmPhoto(timeLogId, keys, metadata)` → server inserts the `timeLogPhotos` row(s). (Doing the row insert on a *confirm* step, after the upload succeeds, avoids orphaned metadata.)

*Simpler alternative:* proxy the upload through a server function that writes to R2. Fine for ~290 KB images; trades direct-to-R2 efficiency for fewer moving parts.

**Serve (authorize-and-stream proxy — preserves caching + team visibility).** Keep the stable per-photo endpoint (`/api/receipt/{id}`, `?thumb=1`):
1. Authenticate the requester.
2. Load the photo → its time log → **authorize**: requester is the uploader, **or** requester is the owner/spouse of the team and the entry is on one of the owner's properties (the team-visibility path from §7 / §12).
3. `GetObject` the key (the `_thumb` variant when `?thumb=1`, falling back to full).
4. Stream the bytes back with `Content-Type` and `Cache-Control: private, max-age=86400, immutable`.

> Do **not** hand raw presigned GET URLs to the client for normal display — they change per request and defeat the cache. Reserve presigned GET for one-off downloads. The proxy is what makes a spouse's receipts appear in the owner's combined PDF while staying private.

**Delete.** On photo delete: `DeleteObject` for **both** the `.jpg` and `_thumb.jpg` keys, then delete the row. Because entries are **soft-deleted** (§4.5), leave their files in place so history/reports stay intact; only purge objects when an entry is **hard**-deleted (e.g. a future cleanup job).

**Config (all server-side secrets).** R2 account endpoint URL, bucket name, access key id + secret. Credentials never reach the client — that is the entire reason for presigned URLs and the serving proxy.

**Cost at 1000 users.** Storage ~$0.015/GB-mo (≈$3–5/mo for 200–300 GB cumulative); **egress $0**; operations negligible once the 24 h cache absorbs repeat reads.

**Backend notes.**
- **Convex:** presigning and `GetObject` run in **actions** / **HTTP actions** (queries/mutations can't do network I/O). Store the key on the `timeLogPhotos` document; serve via an HTTP action. R2 also lifts Convex's comparatively small built-in storage tier, so it's the recommended choice there (see §16.4).
- **Postgres backends (Supabase/Nhost):** the existing serving route swaps its storage client for an S3 client pointed at the R2 endpoint; presign uploads from a server action. Optional on Supabase until built-in egress becomes the binding cost.

---

## 13. Reports, Tax Logic & Exports

### 13.1 Tabs & role gating

| Tab | Owner/Spouse | Manager/Helper (staff) |
|---|---|---|
| **My Hours** (KPIs, goal/test progress, category & property breakdowns) | ✓ | ✓ (own data) |
| **Activity** (chronological, grouped, editable) | ✓ | ✓ (own data) |
| **Team** (per-member hours) | ✓ | ✗ |
| **Reports / Export** (PDF + CSV) | ✓ | ✗ |

A **property filter** and **tax-year** selection apply across reports.

### 13.2 Material-participation tests & the annual goal

The host picks a **target test** (`profiles.targetTest`) and an **annual goal** (`goalHours`):

- **500-hour test** (`500`) — goal defaults to 500.
- **100-hour test** (`100`) — "100+ hours and no one else participates more"; goal defaults to 100.
- **Substantially-all** (`substantially`) — no numeric threshold; reported as a status ("Substantially all"), no progress bar.

**Progress** = sum of the relevant `durationSecs` ÷ 3600 vs. the target, shown as a bar ("Goal reached" / "In progress", with coach text like "120 more hours to reach your goal"). For owner/spouse, "the relevant hours" are **combined** owner+spouse when a spouse exists.

**Staff rule (managers & helpers):** they have **no material-participation test** — hide the target-test UI entirely. Their **annual goal defaults to 100** (and a stored legacy value of 500 must be displayed/treated as 100). They see only their own My Hours/Activity.

### 13.3 Breakdowns

- **By category/task:** name (`title`), hours, % of total; when combined, split mine vs. spouse.
- **By property:** hours per property (and per-person columns when combined).
- **Team tab:** team total + each member's hours and role badge (using the display role), sorted by hours desc; powered by the team-hours accessor (§7), which must read across members regardless of the per-user read scoping.

### 13.4 Tax PDF

A portrait, letter-size, branded PDF intended to support a tax filing. **Sections, in order:**

1. **Header** — title ("Hours Tracking Report"), "Short-Term Rental Activity", the **year**, and the person/people (combined "Owner & Co-Host" when a spouse exists); note the property filter if one is applied.
2. **Summary** — Total Hours Logged (**combined**); if a spouse exists, a row each for the owner's and spouse's hours; Properties Tracked (count).
3. **Hours by Property** — one row per property showing the **address** (preferred over name), total hours, and **per-person columns** when combined; bold total row.
4. **Helper & Manager Hours** — a separate table (Name, Role, Hours) **explicitly labeled "reference only — NOT combined into the material-participation total"**. Rendered only if such hours exist.
5. **Detailed Activity Log — {Person}** — one table **per person** (owner; and spouse if present), sorted most-recent first, with columns **Date · Started · Property · "Task, Details & Notes" · Photos · Hours**. Notes appear under the task within the same cell; **embedded receipt thumbnails** (~180pt) sit in the Photos column.
6. **Disclaimer** — self-reported data, not tax advice, consult a professional.
7. **Footer on every page** — generation date (left), "Page X of Y" (right).

**Photo embedding rule:** thumbnails are embedded as image data; a cell holds at most **3** thumbnails, and overflow spills onto **continuation rows** (same row "stretched" with blank text cells) so images are never clipped or split mid-image. Cells are top-aligned. Corrupt images are skipped silently.

> The current build uses jsPDF + autotable; the binding constraint is that an autotable row can't break across pages, hence the "max-3-per-cell + continuation row" rule. Any PDF engine is fine as long as you honor "never clip an embedded receipt."

### 13.5 CSV email export

- Columns: **Date, Start Time, Hours, Category, Property, Notes** — plus a **"Logged by"** column **when a spouse exists** (so a combined export attributes each row). Combined exports include **both** spouses' logs, merged and sorted by start desc, with a final TOTAL row.
- Delivered as an email **attachment** via the transactional email provider, **from a verified sender address configured in env** (never a hardcoded sandbox address). Subject like "Host Hours Report — {property} — {month} {year}", to the requesting user.

---

## 14. Billing & Subscriptions

- **Tiers** (catalog, §4.2): **free** (1 property; no timer/CSV/geo/team), **professional** (5 properties; all features; ~$19.99/mo or $191.90/yr), **enterprise** (unlimited; all features; ~$49.99/mo or $479.90/yr).
- **Property-slot gate:** creating a property must check the active count against `maxProperties` and block + prompt to upgrade at the limit.
- **Feature flags** (`hasLiveTimer`, `hasCsvExport`, `hasGeoAutostart`, `hasTeamMembers`) gate the corresponding UI/actions per tier.
- **Checkout & portal:** create a payment-provider checkout session for a chosen price; provide a billing portal to manage/cancel; reflect `cancelAtPeriodEnd`, renewal date, status. **Owner-only.**
- **Webhooks (must be idempotent):** verify the provider signature; record each event by its provider event id in the **WebhookEvent** ledger and **skip if already processed** (providers retry). Handle: checkout completed (link customer↔user, store subscription id), subscription created/updated (write tier, period, status), subscription deleted (downgrade/cancel), invoice paid (→ active), invoice failed (→ past_due). The webhook endpoint must be **exempt from auth/session middleware**.
- **Bootstrap:** every new user starts on **free/active** (§6.2).

---

## 15. Geolocation & Auto-Timer

### 15.1 Foreground geolocation (works on web today)

- Use the device's geolocation (high-accuracy, short timeout) to compute **on-site** status: device within a property's `geoRadiusMeters` (default **500m**) via great-circle (haversine) distance. Powers "You are at {Property}", the on-site default when starting a timer, and the on-site flag on entries.
- **Graceful degradation:** denied/unavailable/timeout → empty result → default **remote**. Never block initial render on geolocation; resolve it in the background.
- **Privacy:** location is used transiently to set a flag; the product stores the *property's* coordinates, not a continuous track of the user.

### 15.2 Auto-timer (configuration now, engine later)

The product captures, per team member, an **auto-timer preference**: `autoTimerEnabled` + `defaultTask`. Set at invite time and editable by the member in settings (applies across all their teams).

**Hard platform constraint — the geofence *engine* is native-only.** Automatically starting a timer on **arrival** and stopping it on **departure** while the app is backgrounded **cannot be done on the web**: there is no background Geofencing web API, web geolocation is foreground-only, and service workers can't be woken by location. Therefore:

- **On web, the auto-timer is inert** — the preference is stored but nothing acts on it. Consider feature-flagging the toggle until the engine ships.
- **The engine requires a native app** (e.g. Capacitor + a background-geolocation plugin + "Always" location permission) that reads `autoTimerEnabled`/`defaultTask` and, on geofence crossing, creates/stops timers (and sends a push notification: "Timer started at {Property}" / "…stopped — you left {Property}"). This is the primary reason to ship native, and it pairs with the `hasGeoAutostart` tier flag.

Design the data and the start/stop timer operations so a native client can call them headlessly (a timer started by the engine is just an Active Timer with `source = auto` and `isOnsite = true`).

---

## 16. Building on Convex

This section maps the spec onto Convex specifically, because the explicit motivation for this document is a possible **greenfield Convex build** (not a migration). The good news: **several of the current system's hardest problems are non-issues on Convex.**

### 16.1 Tables

Model each entity in §4 as a Convex table (`defineTable` in `schema.ts`) with indexes for the hot paths:

- `properties` — index `by_user` (`userId`), and a `by_user_active` filter (exclude `deletedAt`).
- `taskTypes` — index `by_user`; enforce `(userId, name)` uniqueness in the mutation.
- `timeLogs` — indexes `by_user`, `by_property`, `by_user_started` (for date ranges), all filtering `deletedAt`. This is your busiest table.
- `activeTimers` — index `by_user`; enforce **one per user** in the mutation (Convex has no DB unique constraint — check-then-insert inside the transaction).
- `timeLogPhotos` — index `by_timeLog`. Store a Convex **storageId** instead of a path (see 16.4).
- `teamMembers` — indexes `by_owner`, `by_member`; enforce one-spouse and unique-email-per-owner in mutations.
- `propertyAssignments` — index `by_member`, `by_property`.
- `invitations` — index `by_token`, `by_teamMember`.
- `subscriptions` — index `by_user` (one per user, enforced in code); `subscriptionTiers` as a small seeded table or a TS constant.
- `webhookEvents` — index `by_providerEventId` for idempotency.

You do **not** need a `spouseLinks` table (§4.12) or the legacy migrations.

### 16.2 Authorization = code (delete the RLS layer)

This is the biggest win. Convex has **no Row-Level Security**; every query/mutation/action runs your code with full DB access, and **you** decide what to return. That means:

- Implement §5.1–5.5 as plain helper functions called at the top of each function, e.g. `requireOwnerOrTeam(ctx, ownerId, allowedRoles)` returning `{ userId, callerRole }` or throwing.
- The current build's "authorize in code, then use the service-role client to dodge RLS gaps" pattern (§5.5) **collapses into just "authorize in code"** — there is no second policy layer to bypass, and no class of silent-empty-result bugs. The whole spouse/manager access model gets dramatically simpler.
- A single helper resolves the acting context: *is the caller the owner, or an `active` `spouse`/`manager` of this owner?* — exactly the `resolveOwnerId` tuple check, but now it's the *only* gate, not a workaround.

### 16.3 Reactivity (a product upgrade, not just a port)

Convex `useQuery` is **live by default**. Use it to remove polling and manual refetches:

- **Active timer & dashboard** update across the user's devices/tabs instantly.
- **Team tab / team hours** recompute live as members log time — no manual "refresh".
- **Reports KPIs** tick up live.
The live timer's *elapsed seconds* still tick client-side from `startedAt`; reactivity handles the start/stop/edit transitions.

### 16.4 File storage

**Recommended: external object storage (Cloudflare R2) — see [§12.1](#121-recommended-implementation--cloudflare-r2-or-any-s3-compatible-store).** Because Convex's included file-storage tier is the smallest of the candidate backends and photos are the cost driver, store receipts in R2 and keep only the **object key** on the `timeLogPhotos` document. Presigning and reads run in Convex **actions** / **HTTP actions** (queries/mutations can't do network I/O); the `?thumb=1` serving + "team can see spouse's photos" logic is just authorization branches in the HTTP action that streams from R2 with private cache headers.

**Simpler alternative: Convex built-in file storage.** `ctx.storage.generateUploadUrl()` for client uploads, store the returned `storageId` on `timeLogPhotos`, serve via an HTTP action that checks access and streams `ctx.storage.get(storageId)` with private cache headers. Fewer moving parts, but you inherit Convex's storage/egress metering — fine to start, revisit if media grows. Either way, keep the **client-side 1280px + 400px thumbnail** strategy (§12) and upload both blobs.

### 16.5 Actions, HTTP actions & scheduling

- **Stripe webhooks** → a Convex **HTTP action** (raw request, signature verification), writing through the `webhookEvents` idempotency ledger (§14). Mutations that touch external services (Stripe API, Resend) are **actions** (they can do network I/O), which then call internal mutations to persist.
- **Email** (invitations, CSV reports) → actions calling the email provider; sender address from an env var.
- **Stop-timer atomicity** (§4.6) is a single mutation (read active timer → insert log → delete timer) — Convex mutations are transactional, so the current Postgres `stop_timer` function and its locking concerns disappear.
- **Ownership transfer** (§7) → one mutation doing the re-pointing transactionally (replaces the stored procedure).
- **Auth** → Convex Auth (or Clerk/Auth0) for email-password + Google; replicate the **pre-confirmed invitation sign-up** by creating the identity server-side keyed off the validated token. The account-bootstrap (§6.2) runs in the post-sign-up callback / a first-login mutation.

### 16.6 What to keep identical

The **product rules** don't change: roles & matrix (§5), the spouse-combine and staff-exempt tax logic (§13), the 10-photo cap and resize dims (§12), the 500m geofence and native-only auto-timer (§15), the tier limits and idempotent webhooks (§14), and all the constants in [Appendix A](#appendix-a--enumerations--constants). Port *those* faithfully; drop the stack-specific scaffolding (RLS policies, service-role dual client, `spouse_links`, SQL migrations, the DB stored procedures).

---

## 17. Non-Functional Requirements

- **Security & privacy.** All data is per-account private; cross-account reads happen only through the team model and only after an explicit authorization check (§5.5). Photos live in private storage and are served only to authorized users. Location is used transiently; no continuous tracking is stored. Webhook endpoints verify provider signatures and skip auth middleware.
- **Performance.** Avoid N+1 in roster/report aggregations (batch lookups). Serve photos with long-lived **private** cache headers via stable URLs (don't defeat caching with per-request signed URLs). Index the hot read paths (logs by user/property/date).
- **Offline / PWA.** Installable web app (manifest, maskable icons, themed). Service worker: **network-first** for navigations with a branded **offline fallback** page; **cache-first** for immutable build assets; **network-only** for API/mutations. Register the service worker in **production only** (and proactively unregister stale ones in dev). Show an **iOS/Safari install hint** (dismissible, remembered) since iOS can't prompt programmatically. Exclude the manifest, service worker, icons, offline page, and webhook routes from auth middleware.
- **Mobile-first UX.** One-tap capture, location awareness, a bottom dock/nav, safe-area awareness. Native packaging is anticipated (the auto-timer engine, §15).
- **Time & timezones.** Bucket "days" in the user's `timezone`. Handle cross-midnight sessions (§10.3).
- **Data retention.** Soft-delete properties and logs (retain for audit/history); never destroy hours as a side effect of deleting a property or removing a team member (offer "keep hours").
- **Resilience.** Idempotent payment webhooks; atomic timer-stop and ownership-transfer; fail **loudly** on authorization/roster errors (a silent empty result is a bug, not a UX).
- **Accessibility & polish.** Sensible color contrast, keyboard-operable forms, clear empty/onboarding states.

---

## 18. Out of Scope / Future

- **Native background geofence auto-timer engine** + push notifications (§15.2) — requires a native shell.
- **Multi-currency / non-US tax regimes** — current logic is U.S. IRS material-participation framing.
- **More than one spouse**, or non-spousal hour-combining — intentionally disallowed.
- **In-app team chat / payroll** — out of scope (hours can be exported).
- **Automated tax filing** — the product produces supporting documents only; it explicitly disclaims tax advice.

---

## Appendix A — Enumerations & Constants

**Roles** (`team_role`): `spouse`, `manager`, `employee` (label "Helper"). Plus the implicit **owner** (account principal). Labels: owner→"Owner", spouse→"Spouse Co-Owner", manager→"Manager" (or custom), employee→"Helper" (or custom).

**Membership status:** `pending`, `active`, `suspended`.

**Subscription status:** `trialing`, `active`, `incomplete`, `incomplete_expired`, `past_due`, `canceled`, `unpaid`, `paused`.

**Target tests:** `500`, `100`, `substantially`.

**Permission keys** (per-role grants): `properties.read`, `properties.write`, `time_logs.read`, `time_logs.write`, `reports.read`, `reports.combined`, `team.read`.
- spouse → all seven.
- manager → properties.read, time_logs.read, time_logs.write, reports.read, team.read.
- employee → time_logs.write, properties.read.
- owner → all (implicit).

**Default Task Types** (seeded per new user, in order): Booking Mgmt, Listing Optimization, Guest Communications, Marketing, Cleaning, Vendor Communications, Landscaping, Restocking, Inspection, Hands-on Repairs, On-Site Vendor Supervision.

**Subscription tiers:**
| Tier | Max properties | Live timer | CSV export | Geo autostart | Team | ~Price |
|---|---|---|---|---|---|---|
| free | 1 | ✗ | ✗ | ✗ | ✗ | $0 |
| professional | 5 | ✓ | ✓ | ✓ | ✓ | $19.99/mo · $191.90/yr |
| enterprise | ∞ | ✓ | ✓ | ✓ | ✓ | $49.99/mo · $479.90/yr |

**Magic numbers:**
- Geofence radius default: **500 m**.
- Photo cap: **10** per entry. Full image ≤ **1280 px** (q≈0.8); thumbnail ≤ **400 px** (q≈0.65).
- PDF: portrait letter; ≤ **3** receipt thumbnails per cell (continuation rows for overflow); thumbnails ~**180 pt**.
- Invitation expiry: **7 days**.
- Dashboard "recent activity" window: **14 days**; recent properties: **3**.
- Photo cache: **private, 24 h, immutable**.
- Default property color: **`#4A148C`** (plum). Theme: plum `#4A148C`, background bone `#F9F6F0`.
- Password minimum: **8** characters.
- Default timezone: **America/New_York**.

---

## Appendix B — Cross-Cutting Business Rules

1. **One active timer per user.** Starting another stops/replaces the first.
2. **Stopping a timer is atomic** and carries `isOnsite` onto the new log.
3. **Spouse hours combine; staff hours never do.** Tax PDF/CSV always combine owner+spouse when a spouse exists; helper/manager hours are reported separately and labeled "not combined".
4. **Staff have no target test;** their annual goal is 100 (legacy 500 shown as 100).
5. **One spouse per owner;** spouse links are bidirectional; the owner can never be removed.
6. **Removing a member can keep their hours** by reassigning their logs on the owner's properties to the owner.
7. **Email change re-pends a membership** (must re-accept at the new address).
8. **Task selection copies a name** onto the entry (no FK); deleting a task type never alters history.
9. **Deleting a property is soft;** it still shows (read-only) if it has logged activity; logs survive.
10. **Property creation is gated** by the subscription's `maxProperties`.
11. **Cross-account access is always explicitly authorized** by the full `(owner, actor, role, active)` tuple, then executed with sufficient privilege; never rely on ambient policy; fail loudly.
12. **Invitations are tokenized proof of email control** → pre-confirmed sign-up; acceptance must match the signed-in email or offer account-switching.
13. **Payment webhooks are idempotent** via a provider-event-id ledger.
14. **On-site is geofence-derived but user-overridable;** geolocation failures default to remote.
15. **The background auto-timer is native-only;** on web it is configuration without an engine.
