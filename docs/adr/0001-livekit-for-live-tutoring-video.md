# ADR-0001: Use LiveKit for live tutoring video

**Date**: 2026-10-03
**Status**: accepted
**Deciders**: Fayzal (owner), Claude (analysis)

## Context

Confirmed tutoring sessions sent both people to the teacher's own Zoom/Meet/Teams
link (`TeacherProfile.meetingUrl`). Anyone with the link could join, we couldn't tell
whether a session happened, and the experience left Xcel Study. We want the call
inside the platform. Constraints: the app runs on Vercel serverless (no long-lived
media server), uses its own session auth, has a strict design system and CSP, and
most users are in Nigeria on mobile networks where latency, packet loss and data
cost matter. Pricing isn't decided, so running cost must stay low until there is revenue.

## Decision

We use LiveKit (open-source WebRTC SFU), starting on LiveKit Cloud. Our server mints
a short-lived join token only after the service layer confirms the viewer is a party
to a CONFIRMED session inside its join window. The room UI is built with
`@livekit/components-react` and styled with our tokens. All provider calls sit behind
a small `VideoProvider` adapter (`src/server/video/`) so the provider can change
without touching services or UI.

Where the web app is hosted doesn't affect this decision: the media server always runs
on its own machine. We move to self-hosted LiveKit (same server, same client code, new
`LIVEKIT_URL`) when the Cloud bill passes about $800 a month or the Nigeria latency test
calls for a server in Lagos.

### As built (2026-10-03)

- **Rooms:** one room per session (`session-<id>`), at `/sessions/<id>`. It opens 10
  minutes before the start and closes 15 minutes after the end. Tokens last 10 minutes
  (LiveKit refreshes them for people already connected), carry the user id as identity,
  and can publish only camera, microphone and screen share, plus data for chat pings.
  Rooms take two people at most and close a minute after the last one leaves.
- **Ending calls:** because LiveKit keeps connected people in, our server closes the room
  itself (`VideoProvider.closeRoom`) when a session is cancelled, a partnership ends or an
  account is suspended, and the room page leaves at the closing time after a warning.
  Follow-up: a scheduled sweep that closes overrunning rooms server-side, for clients that
  ignore the page's own timer.
- **Fallback:** live video is off until all three `LIVEKIT_*` variables are set, and then
  sessions keep the teacher's meeting link. When it's on, that link appears in the room
  only as "Trouble connecting? Use the backup meeting link", and only for a live
  partnership's session that is ahead or under way.
- **In-call chat** is the pair's ordinary message thread: messages are saved and rate
  limited by our server, and LiveKit carries only a content-free "new message" ping.
- **Attendance** comes from signed LiveKit webhooks (`POST /api/livekit/webhook`) into
  `SessionAttendance`, one row per connection, so retries and out-of-order events are
  harmless. Past sessions show who was in the room and for how long.
- **Browser policy:** only `/sessions/*` may use the camera, microphone and screen
  sharing (denied everywhere else, `display-capture` included), or connect to the LiveKit
  host. Links into and out of a room are full page loads, because CSP and
  Permissions-Policy belong to the document.
- **Data costs:** 540p capture, simulcast with 180p and 360p layers, adaptive stream and
  dynacast; people can join with the camera off.
- **Local and CI:** LiveKit runs in Docker like Postgres (`npm run livekit:up`). The E2E
  suite starts a throwaway LiveKit container with a random key per run and has a student
  and teacher meet, chat and leave.

## Alternatives Considered

### Self-hosted LiveKit from day one
- **Pros**: Bandwidth is far cheaper (Hetzner EU includes 20 TB per server, then about €1/TB, against $100–120/TB on LiveKit Cloud); we can choose a Lagos data centre.
- **Cons**: TLS and a domain for the built-in TURN server, monitoring, upgrades, and a second node plus Redis for failover. Recording (Egress) is a separate service with its own CPU needs.
- **Why not yet**: At launch volumes the Cloud bill (~$200/month) is below the cost of the operations time. It's the planned next step, not a rejected option.

### BigBlueButton (self-hosted)
- **Pros**: Purpose-built for online classes: whiteboard, slides, polls, breakout rooms, recording.
- **Cons**: Needs a dedicated server (8 cores, 16 GB RAM); its own UI, which we can't restyle much; heavy for 1:1 tutoring.
- **Why not**: Overkill for tutoring. Reconsider only if we want a ready-made group classroom and accept its look.

### Jitsi, self-hosted
- **Pros**: Free and open source; no per-minute fees; full meeting app.
- **Cons**: Can't run on Vercel; needs its own servers (videobridge, Jicofo, Prosody, TURN) and someone on call. Embedding means an iframe of the Jitsi app, which is hard to make look like Xcel Study. The public meet.jit.si cuts embedded calls off after 5 minutes.
- **Why not**: Operations burden for a small team, and the UI works against our design system.

### Jitsi as a Service (8x8 JaaS)
- **Pros**: Cheapest managed option for repeat 1:1 users (MAU pricing: $99/mo for 300 MAU, then $0.99 each); free up to 25 MAU; hosted; webhooks and recording.
- **Cons**: Still the Jitsi app in an iframe, with limited UI control; no light local server for tests; no AI-agent path.
- **Why not**: The call would look and behave like Jitsi, not Xcel Study. Revisit if cost per active user becomes the deciding factor.

### Cloudflare RealtimeKit (formerly Dyte)
- **Pros**: Anycast SFU in 330+ cities, including Lagos; $0.002 per participant-minute with bandwidth included; UI kit plus a core SDK; recording and webhooks.
- **Cons**: Proprietary; no free tier; no local server for tests; product and docs still settling after the rebrand.
- **Why not**: Close second. Lock-in and no offline testing tip it. Switch if the Nigeria network test clearly favours it.

### Daily / Whereby Embedded
- **Pros**: Mature; prebuilt UIs; Daily has a Cape Town region.
- **Cons**: About $0.004 per participant-minute, roughly 2x Cloudflare and 3x LiveKit at our volumes; proprietary.
- **Why not**: Cost.

### Keep external meeting links (status quo)
- **Why not**: No access control, no attendance, and users leave the platform. Kept only as the in-room backup.

## Consequences

### Positive
- Joining a call is authorised by our own service layer (party, CONFIRMED, join window), like every other feature.
- The same server runs locally in Docker, so integration and E2E tests stay offline, like Postgres.
- Open source: we can self-host LiveKit (for example on a Lagos VPS) without rewriting the client.
- Webhooks give attendance (who joined and for how long), which helps with disputes, reviews and future payments.
- LiveKit Agents leaves room for AI features later (transcripts, lesson notes).

### Negative
- We build the room UI ourselves (device check, controls, layout), which is more work than an iframe.
- LiveKit Cloud bills bandwidth separately ($0.12/GB after 250 GB on Ship), so video quality is capped.
- A new third-party secret (API key and secret) lives in the Vercel environment.
- CSP and Permissions-Policy are loosened on the room route only, and `LIVEKIT_URL` must be set at build time because the headers are built then.

### Risks
- **Latency from Nigeria**: LiveKit Cloud's nearest region is Johannesburg, about 75 ms round trip from Lagos between data centres (London is about 104 ms). That adds roughly 65 ms of delay to a Nigeria-to-Nigeria call compared with a Lagos server: noticeable side by side, still comfortable for conversation. Consumer networks may route worse than data centres. Mitigation: a one-week test measuring round-trip time and packet loss on MTN, Airtel, Glo and fibre; the adapter keeps RealtimeKit (which has Lagos servers) as the fallback, and the backup meeting link covers individual bad calls.
- **Students' data costs**: 540p with simulcast and adaptive stream, and joining with the camera off.
- **Minors on camera**: no recording. Recording waits for a consent and storage policy. In-call chat is saved in the pair's thread rather than lost.
