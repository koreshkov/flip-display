import { sanitizeConfig } from "./config";
import type { DisplayConfig } from "./config";

// A TURN relay is the fallback when two devices can't reach each other
// directly (different networks, strict routers). Configure one through env
// variables, e.g. VITE_TURN_URLS="turn:host:3478,turns:host:5349".
const turnUrls: string | undefined = import.meta.env.VITE_TURN_URLS;

// Passed to every Peer. Without host/port/path it uses the public PeerJS
// cloud server for signaling. The ICE servers replace PeerJS's defaults,
// whose TURN relays no longer resolve.
export const peerOptions = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      ...(turnUrls
        ? [
            {
              urls: turnUrls.split(","),
              username: import.meta.env.VITE_TURN_USERNAME,
              credential: import.meta.env.VITE_TURN_CREDENTIAL,
            },
          ]
        : []),
    ],
  },
};

// Sent by a controller to change the display.
export type ControllerMessage = { type: "set-config"; config: DisplayConfig };
// Sent by the display on connect and after every change.
export type DisplayMessage = { type: "config"; config: DisplayConfig };

// PeerJS touches browser globals on import, so load it only on the client.
export const loadPeer = () => import("peerjs").then((module) => module.Peer);

export function getRemoteUrl(displayId: string) {
  return `${window.location.origin}/remote/${displayId}`;
}

const displayIdKey = "flip-display:id";

// A random ID kept per browser, so the QR code stays valid across reloads.
export function getDisplayId() {
  let id: string | null = null;
  try {
    id = localStorage.getItem(displayIdKey);
  } catch {}
  if (!id) {
    // getRandomValues works on plain-http LAN addresses, randomUUID doesn't.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    id = `flip-display-${hex}`;
    try {
      localStorage.setItem(displayIdKey, id);
    } catch {}
  }
  return id;
}

// Returns the config carried by a message of the given type, if valid.
export function readConfigMessage(
  data: unknown,
  type: (ControllerMessage | DisplayMessage)["type"],
) {
  if (typeof data !== "object" || data === null) return null;
  const message = data as Record<string, unknown>;
  return message.type === type ? sanitizeConfig(message.config) : null;
}
