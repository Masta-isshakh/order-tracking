# Stars — release QA checklist

Automated coverage runs against the deployed backend and is green:

```bash
node scripts/check-backend.mjs     # 10 configuration checks
node scripts/test-auth-flow.mjs    # 16 OTP lifecycle checks
node scripts/test-data-flows.mjs   # 28 workspace + authorization checks
npm run typecheck                  # 0 errors
npx expo export --platform ios     # bundles clean
npx expo export --platform android # bundles clean
```

What follows is the manual pass those cannot do: real devices, real fingers,
real SMS. Run it on **one iPhone and one Android phone** before every store
submission.

---

## A. First launch, signed out

- [ ] App opens on **Home** with no sign-in prompt
- [ ] Splash screen matches the theme (no white flash in dark mode)
- [ ] Home shows company name, tagline, services and packages
- [ ] Pull-to-refresh works on Home
- [ ] **Book** tab lists services and packages with prices
- [ ] Selecting items shows the floating total bar with the correct sum
- [ ] **Settings** is reachable without signing in
- [ ] **Track** shows the verification gate, not an error or an empty list

## B. Themes and language

- [ ] All four themes (Light, Dark, Ocean, Sand) apply instantly
- [ ] "System" follows the OS appearance toggle
- [ ] Theme survives a full app restart
- [ ] Switching to العربية flips the whole layout right-to-left **without a restart**
- [ ] Back arrows, chevrons and tab order all mirror correctly
- [ ] Phone numbers, prices and order codes stay left-to-right in Arabic
- [ ] Language survives a restart
- [ ] No text is clipped or overlapping in Arabic (check the order card and roadmap)

## C. Sign-in

- [ ] An unregistered number is refused with a clear message, and **no SMS arrives**
- [ ] A registered number receives a code within ~10 seconds
- [ ] The SMS reads correctly and names Stars
- [ ] iOS offers the code from the keyboard suggestion bar; Android autofills it
- [ ] A wrong code shows an error and shakes the field
- [ ] Three wrong codes end the session and prompt for a new code
- [ ] "Resend" is disabled for 45 s, then works
- [ ] Resending within the cooldown does **not** invalidate the code already received
- [ ] Waiting 5+ minutes then entering the code is refused as expired
- [ ] "Change number" returns to the phone screen cleanly
- [ ] Airplane mode during verification shows a sensible error, not a crash

## D. Customer workspace

- [ ] After verifying, a customer lands on **Track** with their orders
- [ ] An order card shows status, vehicle, progress bar and step count
- [ ] Opening an order shows the roadmap top to bottom
- [ ] Completed steps show a green check; the current step pulses
- [ ] Photos added by staff appear on completed steps
- [ ] An on-hold order shows the amber banner **with the reason**
- [ ] A completed order shows the green "ready for collection" banner
- [ ] A cancelled order shows the reason
- [ ] Chat opens, sends text and images, and shows staff replies **live** (no refresh)
- [ ] A customer cannot see any other customer's order (test with two accounts)
- [ ] Signing out returns to the storefront and re-locks Track

## E. Supervisor workspace

- [ ] A supervisor number lands directly in the staff workspace
- [ ] The **Team** tab is not visible to a supervisor
- [ ] Order tabs (New / Pending / Completed / History) each list the right orders
- [ ] Search matches name, phone, order number and plate
- [ ] **New order**: all four stages validate and Back preserves entered data
- [ ] Creating an order registers the customer — that number can now sign in
- [ ] The new order appears immediately on the board
- [ ] Starting a step moves the order to In progress
- [ ] Completing the last step moves the order to Completed
- [ ] Photos can be added to a **completed** step
- [ ] Photos cannot be added to a pending step
- [ ] A step can be renamed mid-order, and the customer sees the new name
- [ ] A step can be added to an order already in progress
- [ ] Hold requires a reason and the customer sees it
- [ ] Resume returns the order to In progress
- [ ] Cancel records the reason
- [ ] Services and packages can be created, edited, reordered and deleted
- [ ] Step order in the editor matches the customer's roadmap order
- [ ] Hiding a service removes it from the public Book tab but keeps existing orders intact

## F. Admin workspace

- [ ] An admin sees the **Team** tab
- [ ] Creating a supervisor succeeds and that number can immediately sign in
- [ ] A duplicate phone number is rejected with a clear message
- [ ] Disabling a supervisor blocks their sign-in
- [ ] Re-enabling restores access
- [ ] Removing a supervisor revokes access but keeps their orders
- [ ] The company profile editor updates the public Home tab
- [ ] Hero images upload and display
- [ ] An admin can do everything a supervisor can

## G. Public booking

- [ ] A signed-out visitor can complete a booking
- [ ] Name and phone are required; email and vehicle are optional
- [ ] Success screen shows the order reference
- [ ] The booking appears in the staff **New** tab
- [ ] It carries the roadmap of the chosen services
- [ ] The booking phone number can now sign in and track it
- [ ] More than 5 bookings from one number in a day is refused politely

## H. Devices and robustness

- [ ] Small phone (iPhone SE / 5.5" Android) — nothing clipped
- [ ] Large phone (Pro Max / 6.8") — no stretched layouts
- [ ] Tablet / iPad — usable
- [ ] Landscape does not break the roadmap or chat
- [ ] OS font size at maximum — text still readable, buttons still tappable
- [ ] Dark mode at the OS level with "System" theme selected
- [ ] Killing and reopening the app keeps the session (refresh token lasts 30 days)
- [ ] Offline: lists show an error state with retry, not a blank screen
- [ ] Reconnecting recovers without a restart
- [ ] Backgrounding during an image upload does not corrupt the order
- [ ] Rapid double-taps on Save/Submit do not create duplicates

## I. Permissions

- [ ] Denying the photo permission shows a graceful path, not a crash
- [ ] Denying the camera permission likewise
- [ ] Permission prompts show the custom Stars wording
- [ ] In Arabic, the prompts appear in Arabic

## J. Security spot-checks

These are covered by `test-data-flows.mjs`, but confirm on-device before launch:

- [ ] A customer signed into one account cannot open another customer's order URL
- [ ] A customer cannot reach `/staff/...` routes (they redirect to Home)
- [ ] A supervisor cannot reach the Team tab
- [ ] Signing out clears the session — reopening does not restore it

---

## Known limitations to record

1. **SMS delivery in Qatar needs a registered Sender ID.** The code path is
   verified; carrier delivery is a registration matter. See
   [`SMS-QATAR.md`](SMS-QATAR.md).
2. **No push notifications yet.** Chat and status updates are live while the app
   is open. A customer with the app closed learns about a reply on next open.
   Adding `expo-notifications` plus an AppSync-triggered Lambda is the natural
   next step.
3. **Currency is fixed to QAR** across the app.
4. **Order lists page at 200–300 records.** Fine for a long time; add cursor
   paging to the History tab when volume grows.
