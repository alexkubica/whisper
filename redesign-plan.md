# Redesign Plan

## Proposed Structure

- Make `/` the landing page.
- Move the transcriber UI to `/app`.
- Point the pricing CTA to a waitlist signup flow.

This keeps the marketing page focused on conversion and the product UI focused on one job: turn recordings into text with as little friction as possible.

## Workstreams

### 1. Routing And Page Architecture

- Move the existing transcriber experience out of `src/app/page.tsx` and into the `/app` route.
- Keep the current server-side history loading for signed-in users.
- Update redirects and shared upload flows that currently assume the transcriber lives at `/`.

### 2. Visual System Redesign

- Replace the current brown palette with a cleaner, sharper, more premium visual system.
- Redefine typography, color variables, spacing, surfaces, borders, gradients, and motion.
- Keep the result minimal, modern, and clearly intentional rather than generic SaaS.

### 3. Landing Page

- Build a dedicated homepage with concise, Apple-style messaging.
- Focus the story on the main pain point: long WhatsApp voice notes.
- Sell the outcome instead of the mechanism:
  - turn long voice messages into text
  - catch up faster
  - skim before listening
  - save time every day

### 4. Pricing Section And Waitlist CTA

- Create a `$1/month` pricing section.
- Make the value concrete as roughly `2 hours` of transcription per month.
- Frame the offer around time saved and clarity gained, not technical details.
- Use the primary CTA to drive users to a waitlist signup flow.

### 5. Transcriber UX Rewrite

- Redesign the app flow around three actions:
  - upload or paste
  - transcribe
  - copy result
- Remove verbose helper copy and any implementation-detail language.
- Do not show model names.
- Do not show format support lists, language autodetect copy, or conversion explanations.
- If something fails, show a clear error and nothing more.

### 6. Upload Interaction Improvements

- Add a paste button near the upload input.
- Support pasted files from the clipboard where the browser allows it.
- Make the upload area feel like one obvious action on desktop and mobile.

### 7. Transcript Output Improvements

- Add small icon-only copy buttons to generated transcript text.
- Tighten the reading surface so the transcript is visually primary.
- Keep controls secondary and unobtrusive.

### 8. History Simplification

- Re-evaluate whether archive should exist at all.
- Default direction:
  - remove archive from the UI
  - keep a lightweight recent history section
  - keep delete only if saved history still matters after the redesign

### 9. Metadata And Final Polish

- Update page metadata, title, and description.
- Polish empty, loading, signed-out, and error states.
- Finish responsive behavior across landing and app.

## Execution Order

### Sequential First

1. Split routing so `/` becomes the landing page and `/app` becomes the product UI.
2. Establish the new visual system and global styling direction.

### Then In Parallel

1. Landing page, pricing section, and waitlist CTA
2. Transcriber UX rebuild
3. Paste and copy interactions
4. History simplification and cleanup

### Final Integration

1. Fix share-target and redirect behavior.
2. Do responsive polish across desktop and mobile.
3. Run sanity testing on the full flow.

## Pending Input

- Waitlist destination URL or signup mechanism is still needed unless a placeholder is acceptable.
