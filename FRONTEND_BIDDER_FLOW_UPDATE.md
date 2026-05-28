# Frontend changes – Bidder verification code flow (no issuer approval)

This document describes the frontend updates required after the backend change:
- Bidder no longer “applies” first and then waits for issuer/admin approval.
- Bidder explicitly clicks **Request code**.
- Backend immediately generates a **unique code for that bidder + tender**, emails it to the bidder, and marks the request as **approved**.
- Bidder then enters the code (Verify), and proceeds to **Apply**.

---

## 0) Important: correct API base path + route paths

In this backend, the verification-code router is mounted at:

- Base path: `GET/POST ... /api/verification-code/...`

And inside that router, bidder endpoints are defined as:

- `POST /request/:tenderId`
- `POST /verify/:tenderId`
- `GET  /status/:tenderId`

So the **full URLs** the frontend must call are:

- **Request code:** `POST /api/verification-code/request/:tenderId`
- **Verify code:** `POST /api/verification-code/verify/:tenderId`
- **Check status:** `GET /api/verification-code/status/:tenderId`

If you call `/api/verification-codes/...` (plural) or `/api/verification-code/:tenderId/request` (wrong order), Express will return **Not Found**.

---

## 1) UI/UX changes

### Tender details / Apply entry point
Replace the old flow ("Apply" ➜ request ➜ wait for approval) with:

1. **Request code** button
2. **Enter verification code** input + **Verify** button
3. **Apply** button (enabled only after verification succeeds)

Recommended UI states:
- **No request yet**: show `Request code`
- **Code generated**: show `Enter code` + `Verify`
- **Code verified**: enable `Apply` CTA
- **Already applied**: disable all and show info message

Backend still returns a `requiresVerification: true` error if user tries to apply without verification.

---

## 2) API contract (what frontend should call)

### A) Request code
**POST** `/api/verification-code/request/:tenderId`
- Auth: required
- Body: `{ "message": "optional" }`

**Success (201)** returns:
- `message: "Verification code generated and sent successfully"`
- `request: { ... , status: "approved", codeUsed: false }`

**Important behaviors:**
- If bidder already has an unused code for this tender, backend returns **400** with `hasApprovedCode: true`.

Frontend action:
- On 201: show toast “Code sent to your email”, then show the verify UI.
- On 400 + `hasApprovedCode`: show “Code already sent, check email”, show verify UI.


### B) Check verification status (for a tender)
**GET** `/api/verification-code/status/:tenderId`

Response can include:
- `hasApplied: true` (bidder already applied)
- `hasApprovedCode: true` (code exists but not verified)
- `noRequest: true` (no unused code exists)

Frontend action:
- Call this when loading the tender details page to decide which UI state to show.


### C) Verify code
**POST** `/api/verification-code/verify/:tenderId`
- Body: `{ "verificationCode": "AB12CD34" }`

**Success (200)**:
- `verified: true`

Frontend action:
- On success, set local state `isVerified = true` and enable Apply.


### D) Apply
**POST** `/api/applications/:tenderId/apply`
- unchanged payload

If the bidder didn’t verify yet:
- backend returns **403** with `{ requiresVerification: true }`

Frontend action:
- Catch 403 + `requiresVerification` and redirect user to the verification UI section.

---

## 3) State management changes (suggested)

Add these per-tender UI states:
- `hasApplied: boolean`
- `hasApprovedCode: boolean`
- `isVerified: boolean`
- `isRequestingCode: boolean`
- `isVerifyingCode: boolean`

Suggested logic:
1. On page load, call `GET /api/verification-code/status/:tenderId`
2. If `hasApplied` → lock UI
3. Else if `hasApprovedCode` → show verify input
4. Else (`noRequest`) → show Request code
5. After request code success → show verify input
6. After verify success → enable Apply

Note:
- Verification is currently tracked by backend via `codeUsed: true` on the request.
- If user refreshes after verifying, `status` will return `noRequest: true` (because there is no longer an *unused* code).
  - Your UI should treat “verified” as either:
    - keep a local `isVerified` flag in memory for the current session, OR
    - (recommended) simply try applying; if backend rejects with `requiresVerification`, prompt for request/verify again.

---

## 4) Remove issuer/admin approval UI (optional cleanup)

If your frontend has screens/components for issuers/admins to:
- view pending verification requests
- approve/reject verification requests

Those are no longer required for the bidder flow.

You can:
- Hide “Verification Requests” menus, or
- Keep them temporarily but expect they will no longer receive new `pending` requests (new requests are auto-approved).

---

## 5) Copy changes checklist

- [ ] Replace “Apply” entry flow with “Request code” first
- [ ] Implement `request code` API call
- [ ] Implement `verify code` API call
- [ ] Gate `apply` behind successful verify (and handle 403 requiresVerification)
- [ ] Add status check on tender page load
- [ ] Update text copy: remove “waiting for issuer approval” references

---

## 6) Quick QA scenarios

1. Bidder opens tender with no code:
   - Sees “Request code”
2. Bidder requests code:
   - Sees “sent to email”
   - Can enter code and verify
3. Bidder verifies with wrong code:
   - Sees “Invalid verification code”
4. Bidder verifies with correct code:
   - Apply becomes enabled
5. Bidder tries to apply without verifying:
   - API returns 403 requiresVerification; UI prompts verify
6. Bidder already applied:
   - UI shows applied state
