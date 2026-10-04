/**
 * The seam between Xcel Study and its video service (ADR-0001). Services and
 * pages only use this interface, so moving from LiveKit Cloud to a self-hosted
 * server, or to another provider, changes one file.
 */

export type JoinRequest = {
  room: string;
  /** Our user id: stable, and doesn't reveal an email address to the other person. */
  identity: string;
  name: string;
  role: "student" | "teacher";
};

/** Room events we act on. Everything else a provider sends is reported as "ignored". */
export type VideoEvent =
  | { kind: "joined" | "left"; eventId: string; room: string; identity: string; participantSid: string; at: Date }
  | { kind: "ignored"; eventId: string };

export interface VideoProvider {
  /** Where browsers connect. */
  readonly serverUrl: string;
  /** A short-lived token that lets one person into one room. */
  createJoinToken(request: JoinRequest): Promise<string>;
  /** Checks a webhook's signature; returns null if it doesn't verify or can't be read. */
  verifyWebhook(body: string, authorization: string | null): Promise<VideoEvent | null>;
  /** Ends a room and disconnects everyone in it. A room that doesn't exist is already closed. */
  closeRoom(room: string): Promise<void>;
}
