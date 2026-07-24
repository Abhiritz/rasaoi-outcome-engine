# ROE-010 — Delivery handoff URLs (DoorDash / Uber Eats)

| Field | Value |
|-------|--------|
| Ticket | **ROE-010** (FUL-002) |
| Ask / symptom | Delivery buttons often do nothing useful — `doordash_url` / `ubereats_url` null on catalog |
| Parent | `develop` |
| Proposed branch | `feature/ROE-010-delivery-handoff-urls` |
| Status | **Awaiting approval** (after or with ROE-009) |
| Related | ROE-009 contacts; ROE-011 dish clipboard text |

---

## 1. Problem

FulfillmentSheet opens `r.doordash_url` / `r.ubereats_url`. Personal sync seeds often set both to **null**. Click still copies clipboard + toast but **skips `window.open`** → dead handoff.

Places-search can build search URLs from name+address; catalog path does not guarantee the same.

---

## 2. Required / best scenario

| Moment | Required |
|--------|----------|
| Venue shown on Reading | Always has non-null DD/UE URLs **or** client builds search fallback at click |
| Delivery click | Clipboard + opens platform search/store; never silent no-op |
| Prefer | Real store links when known; else `name + address/neighborhood` search URL |

---

## 3. Scope (sketch)

| ID | Change | Risk |
|----|--------|------|
| **a** | Client fallback URL builders in FulfillmentSheet / lib | Low |
| **b** | Backfill seed/sync to never leave null when name known | Med |
| **c** | Disable button only if name missing (shouldn’t happen) | Low |

**Out of scope:** Menu-item deep links / affiliates (later).

---

## 4. Deploy

Frontend (+ optional seed SQL). No edge required unless places normalize changes.

---

## 5. Status

Awaiting approval — implement after or parallel to ROE-009.
