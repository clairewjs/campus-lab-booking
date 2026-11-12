# LabSpace

Big Lab and Small Lab booking for Sprott Shaw College PN and HCA programs.

## Application

- Student page: https://clairewjs.github.io/campus-lab-booking/
- Instructor workspace: https://campus-lab-booking.clairewjs.chatgpt.site/?view=instructor

The student page is deployed from the root of the `main` branch through GitHub Pages. It uses a Cloudflare Worker and D1 database hosted through Sites for shared records. GitHub Pages does not run the database or server API. Student request names, email addresses and supplies are never stored in this repository or included in public calendar responses.

The instructor signs in with the authorized ChatGPT account. Every instructor mutation is authorized on the server; hiding buttons is not the authorization mechanism. Set `ADMIN_EMAIL` in the backend runtime to the owner's verified email. No passwords or authentication secrets belong in GitHub.

## Workflow

1. Students view approved bookings and classes, filter by lab, and request a time.
2. Requests save as pending. They do not reserve a calendar slot.
3. After saving, the browser sends the fixed-recipient EmailJS template through the authorized Gmail service to Claire. Provider acceptance does not prove inbox delivery.
4. Claire reviews requests in the instructor workspace. Approval checks for overlaps and writes atomically. Classes and manual bookings can also be added, edited and removed.

Bookings use Vancouver wall-clock dates and times. The calendar shows 7 am–8 pm; requests outside this display can be entered in the form. Overnight bookings must be split into separate dates. Capacity limits and campus opening hours are not yet configured.

## Email setup

EmailJS is connected to the authorized Gmail sender. The template recipient is fixed at `claire.song@sprottshaw.com`; the requester cannot select another recipient. `app/booking-email.ts` contains only public integration identifiers. No mailbox credentials, OAuth tokens or private keys are in the browser or repository. Notifications are sent only after the shared backend saves the pending request. Failed notification calls leave the request saved and offer an email-draft fallback.

Resend and FormSubmit are not used by this version. No custom domain is required.

## Development

Use Node 22 or later and install dependencies with `npm ci`.

- `npm run dev`: full application preview (requires local D1 setup).
- `npm run build:pages`: rebuild the committed student frontend in `/docs` after UI changes.
- `npm run build`: build the Worker application.
- `npm run db:generate`: generate new database schema migrations.

The backend allows browser requests from its own origin and `https://clairewjs.github.io`. Only anonymous, sanitized calendar reads and student submissions are used cross-origin. Instructor actions are same-origin and require authenticated instructor identity. API responses use `Cache-Control: no-store`. Request throttling and a honeypot help reduce automated submissions.

Preserve `.openai/hosting.json` for the existing backend deployment. Backend changes require deploying the matching source through Sites, including schema migrations. A GitHub commit by itself updates only the GitHub Pages frontend, not the backend Worker.

## Repository files

`index.html` is the self-contained student page. Readable application source is included alongside it; `LabSpace-source.zip` contains the complete project with the lockfile and migrations. Extract the archive before development. Rebuilding creates `docs/app.js`, `docs/style.css` and `docs/index.html`; combine them into the root `index.html` when updating this Pages deployment.
