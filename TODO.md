# TODO - Fix “can’t see type / prev one / unable to load request” (Leaves UI)

## Step 1: Reproduce & identify exact failure point
- [ ] Determine whether the failure is on `/leaves` list or `/leaves/[id]` details.
- [ ] Confirm whether UI error is “leaveType.name undefined” or an API “Unable to load request”.

## Step 2: Verify API payload shape
- [x] Read `server/src/controllers/leave.controller.js`.
- [ ] Confirm `GET /leaves` and `GET /leaves/:id` both include `leaveType` relation via `getLeaveSelect()`.
- [ ] If payload is correct, inspect client types vs actual response.

## Step 3: Add defensive UI fallback (no schema change)
- [x] Update `client/app/leaves/page.tsx` and `client/app/leaves/[id]/page.tsx` to safely render leave type even if missing.


## Step 4: Harden API responses
- [ ] If server sometimes omits `leaveType`, enforce include consistently.
- [ ] If comments/thread calls break the page, ensure they don’t block initial load.

## Step 5: Run & verify
- [ ] Start server + Next client.
- [ ] Open Leaves list and detail pages.
- [ ] Confirm type displays + previous navigation works.

