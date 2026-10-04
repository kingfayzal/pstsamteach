import "server-only";
import { AccessToken, RoomConfiguration, RoomServiceClient, TrackSource, type WebhookEvent, WebhookReceiver } from "livekit-server-sdk";
import type { LiveKitConfig } from "@/lib/live-sessions";
import type { VideoEvent, VideoProvider } from "./provider";

/**
 * Only needed to connect: LiveKit refreshes tokens for people already in the
 * room. Ending a session, a partnership or an account closes its room instead
 * (VideoProvider.closeRoom).
 */
const TOKEN_TTL_SECONDS = 10 * 60;

/**
 * Applied when the first person's token creates the room: the student and
 * teacher only (the same person joining again replaces their old connection),
 * and the room closes soon after it empties.
 */
const ROOM_CONFIG = new RoomConfiguration({ maxParticipants: 2, emptyTimeout: 5 * 60, departureTimeout: 60 });

/** Camera, microphone and screen sharing. Data is allowed too, for in-call chat notifications. */
const PUBLISH_SOURCES = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

const JOINED = new Set(["participant_joined"]);
// An aborted connection never fully joined; closing it is harmless if nothing was recorded.
const LEFT = new Set(["participant_left", "participant_connection_aborted"]);

function seconds(value: bigint | undefined): Date | null {
  return value && value > BigInt(0) ? new Date(Number(value) * 1000) : null;
}

function toVideoEvent(event: WebhookEvent): VideoEvent {
  const room = event.room?.name;
  const participant = event.participant;
  const kind = JOINED.has(event.event) ? "joined" : LEFT.has(event.event) ? "left" : null;
  if (!kind || !room || !participant?.identity || !participant.sid) return { kind: "ignored", eventId: event.id };
  const at = (kind === "joined" ? seconds(participant.joinedAt) : null) ?? seconds(event.createdAt) ?? new Date();
  return { kind, eventId: event.id, room, identity: participant.identity, participantSid: participant.sid, at };
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}

export function createLiveKitProvider(config: LiveKitConfig): VideoProvider {
  const receiver = new WebhookReceiver(config.apiKey, config.apiSecret);
  // Closing a room happens after a cancellation or suspension has been saved; don't keep that request waiting.
  const rooms = new RoomServiceClient(config.httpUrl, config.apiKey, config.apiSecret, { requestTimeout: 5 });
  return {
    serverUrl: config.url,

    async createJoinToken({ room, identity, name, role }) {
      const token = new AccessToken(config.apiKey, config.apiSecret, { identity, name, ttl: TOKEN_TTL_SECONDS, attributes: { role } });
      token.addGrant({
        room,
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: PUBLISH_SOURCES,
        canUpdateOwnMetadata: false,
      });
      token.roomConfig = ROOM_CONFIG;
      return token.toJwt();
    },

    async closeRoom(room) {
      try {
        await rooms.deleteRoom(room);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },

    async verifyWebhook(body, authorization) {
      if (!authorization) return null;
      try {
        return toVideoEvent(await receiver.receive(body, authorization));
      } catch {
        return null;
      }
    },
  };
}
