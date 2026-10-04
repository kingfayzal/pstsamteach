"use client";

import "@livekit/components-styles";
import {
  ConnectionStateToast,
  DisconnectButton,
  LiveKitRoom,
  MediaDeviceMenu,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  usePreviewTracks,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import {
  ConnectionError,
  ConnectionErrorReason,
  ConnectionState,
  DisconnectReason,
  isBrowserSupported,
  MediaDeviceFailure,
  Room,
  type RoomOptions,
  Track,
  VideoPresets,
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { joinWindow } from "@/lib/live-sessions";
import { formatClock } from "@/lib/time-zones";
import { joinLiveSessionAction } from "@/server/actions/live-sessions";
import { BackupLink } from "./backup-link";
import { CallChat } from "./call-chat";

/**
 * Data costs matter for students on mobile plans: capture at 540p, publish
 * lower simulcast layers too, and only receive the size each tile shows.
 */
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h540.resolution },
  publishDefaults: { simulcast: true, videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] },
};

const CLOSING_WARNING_MS = 5 * 60_000;
const CONNECT_FAILED = "We couldn't connect to the video room. Check your internet connection and try again.";
const UNREACHABLE = "We couldn't reach Xcel Study. Check your internet connection and try again.";
const SEND_FAILED = "Your camera or microphone couldn't be sent. Check your internet connection.";

type Choices = { camera: boolean; microphone: boolean };
const DEFAULT_CHOICES: Choices = { camera: true, microphone: true };

type LeftReason = DisconnectReason | "time-up" | undefined;

type Stage =
  | { kind: "lobby"; choices: Choices; error?: string }
  /** `closesAtLocal` is when the room closes on this device's clock, worked out from the server's countdown. */
  | { kind: "call"; room: Room; token: string; serverUrl: string; choices: Choices; closesAtLocal: number }
  | { kind: "left"; reason: LeftReason; choices: Choices };

type Props = {
  sessionId: string;
  viewerId: string;
  role: "student" | "teacher";
  otherName: string;
  teacherName: string;
  startsAt: Date;
  endsAt: Date;
  agenda: string | null;
  timeZone: string;
  backupUrl: string | null;
  backHref: string;
};

const noSubscription = () => () => {};

/** Phones show chat over the call rather than beside it. */
const NARROW = "(max-width: 639px)";
function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function deviceProblem(error: Error | MediaDeviceFailure | undefined): string {
  const failure = error instanceof Error ? MediaDeviceFailure.getFailure(error) : error;
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return "Your browser blocked the camera or microphone. Allow them from the icon in the address bar, then try again.";
    case MediaDeviceFailure.NotFound:
      return "We couldn't find a camera or microphone. You can still join, listen and use the chat.";
    case MediaDeviceFailure.DeviceInUse:
      return "Another app is using your camera or microphone. Close it and try again.";
    default:
      return "Your camera or microphone isn't working. Check your device settings and try again.";
  }
}

function leftMessage(reason: LeftReason, otherFirstName: string): string {
  switch (reason) {
    case "time-up":
      return "The room has closed for this session.";
    case DisconnectReason.CLIENT_INITIATED:
      return "You left the session.";
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "You joined from another tab or device, so this window left the room.";
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return "The room has closed.";
    default:
      return `Your connection dropped. Rejoin to carry on with ${otherFirstName}.`;
  }
}

/** Leaving the room is a full page load, so the next page gets its own, stricter camera rules back. */
function BackLink({ href, label, className }: { href: string; label: string; className: string }) {
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

/** The whole session room: a camera check, the call itself, and what you see after leaving. */
export function LiveRoom(props: Props) {
  const { sessionId, otherName, backHref } = props;
  const [stage, setStage] = useState<Stage>({ kind: "lobby", choices: DEFAULT_CHOICES });
  const [mediaProblem, setMediaProblem] = useState<string | null>(null);
  const [joining, startJoining] = useTransition();
  const connected = useRef(false);
  const timeUp = useRef(false);
  const otherFirstName = otherName.split(" ")[0];

  function join(choices: Choices) {
    setMediaProblem(null);
    connected.current = false;
    timeUp.current = false;
    startJoining(async () => {
      try {
        const result = await joinLiveSessionAction(sessionId);
        // Signed out meanwhile: the action redirects to the login page and returns nothing.
        if (!result) return;
        setStage(
          result.ok
            ? {
                kind: "call",
                room: new Room(ROOM_OPTIONS),
                token: result.token,
                serverUrl: result.serverUrl,
                choices,
                closesAtLocal: Date.now() + result.closesInMs,
              }
            : { kind: "lobby", choices, error: result.message },
        );
      } catch {
        setStage({ kind: "lobby", choices, error: UNREACHABLE });
      }
    });
  }

  // Stable handlers: LiveKitRoom reconnects and re-subscribes whenever these change.
  const room = stage.kind === "call" ? stage.room : null;
  const choices = stage.choices;
  const onConnected = useCallback(() => {
    connected.current = true;
  }, []);
  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      // A connection that never succeeded is reported through onError instead, unless the person left on purpose.
      if (!connected.current && reason !== DisconnectReason.CLIENT_INITIATED) return;
      setStage({ kind: "left", reason: timeUp.current ? "time-up" : reason, choices });
    },
    [choices],
  );
  const onError = useCallback(
    (error: Error) => {
      // Leaving while still connecting: onDisconnected shows the "left" screen.
      if (error instanceof ConnectionError && error.reason === ConnectionErrorReason.Cancelled) return;
      // LiveKit reports both failed connections and media that won't start or send here. Only a room
      // that isn't connected ends the call; people can carry on without video, or fix the problem.
      if (!room || room.state === ConnectionState.Disconnected) setStage({ kind: "lobby", choices, error: CONNECT_FAILED });
      else setMediaProblem(error instanceof ConnectionError ? SEND_FAILED : deviceProblem(error));
    },
    [room, choices],
  );
  const onMediaDeviceFailure = useCallback((failure?: MediaDeviceFailure) => setMediaProblem(deviceProblem(failure)), []);
  const dismissNotice = useCallback(() => setMediaProblem(null), []);
  const onTimeUp = useCallback(() => {
    timeUp.current = true;
  }, []);

  if (stage.kind === "call") {
    return (
      <LiveKitRoom
        room={stage.room}
        serverUrl={stage.serverUrl}
        token={stage.token}
        connect
        audio={stage.choices.microphone}
        video={stage.choices.camera}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        onMediaDeviceFailure={onMediaDeviceFailure}
        data-lk-theme="default"
        className="live-room flex min-h-0 flex-1 flex-col bg-ink-deep"
      >
        <CallStage {...props} closesAtLocal={stage.closesAtLocal} notice={mediaProblem} onDismissNotice={dismissNotice} onTimeUp={onTimeUp} />
        <RoomAudioRenderer />
        <ConnectionStateToast />
      </LiveKitRoom>
    );
  }

  if (stage.kind === "left") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10 sm:px-6">
        <h1 className="text-3xl text-ink">{leftMessage(stage.reason, otherFirstName)}</h1>
        <div className="flex flex-wrap items-center gap-4">
          {stage.reason !== "time-up" ? (
            <button type="button" onClick={() => join(stage.choices)} disabled={joining} className={buttonClasses("primary")}>
              {joining ? "Rejoining…" : "Rejoin the session"}
            </button>
          ) : null}
          <BackLink href={backHref} label={`Back to ${otherFirstName}`} className={buttonClasses("quiet")} />
        </div>
        <BackupLink url={props.backupUrl} role={props.role} teacherName={props.teacherName} />
      </div>
    );
  }

  return <Lobby {...props} initial={stage.choices} error={stage.error} joining={joining} onJoin={join} />;
}

function Lobby({
  otherName,
  startsAt,
  endsAt,
  agenda,
  timeZone,
  backupUrl,
  backHref,
  role,
  teacherName,
  initial,
  error,
  joining,
  onJoin,
}: Props & { initial: Choices; error?: string; joining: boolean; onJoin: (choices: Choices) => void }) {
  const [camera, setCamera] = useState(initial.camera);
  const [microphone, setMicrophone] = useState(initial.microphone);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const supported = useSyncExternalStore(noSubscription, isBrowserSupported, () => true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const otherFirstName = otherName.split(" ")[0];

  // Both must keep their identity between renders, or the preview reopens the camera each time.
  // A browser that can't make calls isn't asked for the camera at all.
  const options = useMemo(
    () => ({ audio: supported && microphone, video: supported && camera ? { resolution: VideoPresets.h540.resolution } : false }),
    [supported, camera, microphone],
  );
  const onPreviewError = useCallback((e: Error) => setDeviceError(deviceProblem(e)), []);
  const tracks = usePreviewTracks(options, onPreviewError);
  const videoTrack = tracks?.find((t) => t.kind === Track.Kind.Video);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !videoTrack) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  function toggle(set: (on: boolean) => void, on: boolean) {
    setDeviceError(null);
    set(on);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl text-ink">Session with {otherName}</h1>
      <p className="figures mt-1 text-lg text-ink-soft">
        {formatClock(startsAt, timeZone)}–{formatClock(endsAt, timeZone)}
      </p>
      {agenda ? <p className="mt-1 text-base text-ink-soft">To cover: {agenda}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="relative aspect-video overflow-hidden rounded-control bg-ink-deep">
          {camera && videoTrack ? (
            <video ref={videoRef} muted playsInline aria-label="Your camera" className="h-full w-full -scale-x-100 object-cover" />
          ) : (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-base text-paper/75">{camera ? "Starting your camera…" : "Your camera is off"}</p>
          )}
        </div>

        <div className="space-y-5">
          {supported ? (
            <>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-lg font-bold text-ink">Check before you join</legend>
                <label className="flex items-center gap-3 text-base text-ink">
                  <input type="checkbox" checked={camera} onChange={(e) => toggle(setCamera, e.target.checked)} className="size-5 accent-ink" />
                  Camera on
                </label>
                <label className="flex items-center gap-3 text-base text-ink">
                  <input type="checkbox" checked={microphone} onChange={(e) => toggle(setMicrophone, e.target.checked)} className="size-5 accent-ink" />
                  Microphone on
                </label>
                <p className="text-sm text-muted">With your camera off the call uses far less data.</p>
              </fieldset>

              <button type="button" onClick={() => onJoin({ camera, microphone })} disabled={joining} className={buttonClasses("primary", "md", "w-full")}>
                {joining ? "Joining…" : "Join the session"}
              </button>
            </>
          ) : (
            <p role="alert" className="border border-amber/30 bg-amber-wash px-3 py-2 text-base text-amber">
              This browser can&rsquo;t join video calls. Open this page in Chrome, Safari, Firefox or Edge. If you opened it from inside another app, use
              that app&rsquo;s &ldquo;Open in browser&rdquo; option.
            </p>
          )}

          {error || deviceError ? (
            <p role="alert" className="border border-danger/30 bg-danger-wash px-3 py-2 text-sm text-danger">
              {error ?? deviceError}
            </p>
          ) : null}

          <BackupLink url={backupUrl} role={role} teacherName={teacherName} />
          <BackLink
            href={backHref}
            label={`Back to ${otherFirstName}`}
            className="inline-block py-2 text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
          />
        </div>
      </div>
    </div>
  );
}

function CallStage({
  sessionId,
  viewerId,
  role,
  otherName,
  teacherName,
  startsAt,
  endsAt,
  timeZone,
  backupUrl,
  notice,
  onDismissNotice,
  onTimeUp,
  closesAtLocal,
}: Props & { notice: string | null; onDismissNotice: () => void; onTimeUp: () => void; closesAtLocal: number }) {
  const room = useRoomContext();
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [closingSoon, setClosingSoon] = useState(false);
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function");
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const chatButton = useRef<HTMLButtonElement>(null);
  const otherFirstName = otherName.split(" ")[0];
  // Shown in the viewer's time zone; the timers below run on the server's countdown instead.
  const closesAt = joinWindow({ startsAt, endsAt }).closesAt;

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const remote = tracks.filter((t) => !t.participant.isLocal);
  const remoteShare = remote.find((t) => t.source === Track.Source.ScreenShare);
  const remoteCamera = remote.find((t) => t.source === Track.Source.Camera);
  const localCamera = tracks.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);
  // A shared screen takes the stage; the person who shared it moves to the corner.
  const main = remoteShare ?? remoteCamera;
  const corner = [remoteShare ? remoteCamera : undefined, localCamera].filter((t) => t !== undefined);

  // The room closes a little after the booked end: warn first, then leave.
  useEffect(() => {
    const untilClose = closesAtLocal - Date.now();
    const warn = setTimeout(() => setClosingSoon(true), Math.max(untilClose - CLOSING_WARNING_MS, 0));
    const close = setTimeout(() => {
      onTimeUp();
      void room.disconnect();
    }, Math.max(untilClose, 0));
    return () => {
      clearTimeout(warn);
      clearTimeout(close);
    };
  }, [closesAtLocal, room, onTimeUp]);

  // Closing or reloading the tab mid-call asks first.
  useEffect(() => {
    const confirmLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, []);

  const returnFocus = useRef(false);
  const toggleChat = useCallback(() => {
    setUnread(0);
    setChatOpen((open) => !open);
  }, []);
  const closeChat = useCallback(() => {
    returnFocus.current = true;
    setChatOpen(false);
  }, []);
  // Back to the Chat button once the panel has gone (on phones the call behind it is inert until then).
  useEffect(() => {
    if (chatOpen || !returnFocus.current) return;
    returnFocus.current = false;
    chatButton.current?.focus();
  }, [chatOpen]);
  const countUnread = useCallback(() => setUnread((n) => n + 1), []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col sm:flex-row">
      <div inert={chatOpen && narrow} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <h1 className="sr-only">Session with {otherName}</h1>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <p className="text-sm text-paper/80">
            Session with {otherName}, until <span className="figures">{formatClock(endsAt, timeZone)}</span>
          </p>
          <BackupLink url={backupUrl} role={role} teacherName={teacherName} tone="stage" />
        </div>

        {notice ? (
          <div role="alert" className="mx-2 mb-2 flex items-start justify-between gap-3 rounded-control bg-danger px-3 py-2 text-sm text-paper">
            <p>{notice}</p>
            <button type="button" onClick={onDismissNotice} className="shrink-0 py-1 font-bold underline underline-offset-4">
              Dismiss
            </button>
          </div>
        ) : null}
        {/* Always mounted, so screen readers announce the warning when it's filled in. */}
        <div role="status" className={closingSoon ? "mx-2 mb-2 rounded-control bg-ink px-3 py-2 text-sm text-paper" : "sr-only"}>
          {closingSoon ? (
            <>
              The room closes at <span className="figures">{formatClock(closesAt, timeZone)}</span>. Book another session to carry on.
            </>
          ) : null}
        </div>

        <div className="relative min-h-0 flex-1 px-2">
          {main ? (
            <ParticipantTile trackRef={main} className="h-full w-full" />
          ) : (
            <div className="grid h-full place-items-center rounded-control bg-ink px-6 text-center">
              <p className="text-lg text-paper/85">Waiting for {otherFirstName} to join…</p>
            </div>
          )}
          <div className="absolute right-4 bottom-3 flex w-28 flex-col gap-2 sm:w-48">
            {corner.map((t) => (
              <ParticipantTile key={`${t.participant.identity}-${t.source}`} trackRef={t} className="aspect-video shadow-lift" />
            ))}
          </div>
          <StartAudio label="Turn on sound" className="absolute top-3 left-4" />
        </div>

        <div role="group" aria-label="Call controls" className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/15 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="lk-button-group">
              <TrackToggle source={Track.Source.Microphone} showIcon>
                <span className="max-sm:sr-only">Microphone</span>
              </TrackToggle>
              <div className="lk-button-group-menu">
                <MediaDeviceMenu kind="audioinput" aria-label="Choose a microphone" />
              </div>
            </div>
            <div className="lk-button-group">
              <TrackToggle source={Track.Source.Camera} showIcon>
                <span className="max-sm:sr-only">Camera</span>
              </TrackToggle>
              <div className="lk-button-group-menu">
                <MediaDeviceMenu kind="videoinput" aria-label="Choose a camera" />
              </div>
            </div>
            {canShare ? (
              <TrackToggle source={Track.Source.ScreenShare} captureOptions={{ audio: true, selfBrowserSurface: "exclude" }} showIcon>
                <span className="max-sm:sr-only">Share screen</span>
              </TrackToggle>
            ) : null}
            <button ref={chatButton} type="button" className="lk-button" aria-expanded={chatOpen} aria-controls="call-chat" onClick={toggleChat}>
              Chat{unread > 0 ? <span className="figures rounded-full bg-paper px-2 text-xs font-bold text-ink">{unread} new</span> : null}
            </button>
          </div>
          <DisconnectButton>Leave</DisconnectButton>
        </div>
        <p role="status" className="sr-only">
          {unread > 0 ? `${unread} new ${unread === 1 ? "message" : "messages"} from ${otherFirstName}` : ""}
        </p>
      </div>

      <div className={chatOpen ? "flex min-h-0 max-sm:absolute max-sm:inset-0 max-sm:z-20" : "contents"}>
        <CallChat
          sessionId={sessionId}
          viewerId={viewerId}
          otherName={otherName}
          timeZone={timeZone}
          visible={chatOpen}
          onClose={closeChat}
          onUnread={countUnread}
        />
      </div>
    </div>
  );
}
