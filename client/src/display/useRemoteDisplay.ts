import { useCallback, useEffect, useRef, useState } from "react";
import type { DataConnection } from "peerjs";
import type { DisplayConfig } from "./config";
import { loadPeer, peerOptions, readConfigMessage } from "./peer";
import type { ControllerMessage } from "./peer";

export type RemoteStatus =
  | "connecting"
  | "connected"
  // The display isn't online under that ID.
  | "unavailable"
  // The display was found but no direct connection could be made.
  | "failed"
  // The connection worked but has been lost.
  | "disconnected";

// Give up on a connection that hasn't opened after this long.
const connectTimeout = 15000;

// Connects to a display as a controller. `config` is the display's current
// config, refreshed whenever any controller changes it.
export function useRemoteDisplay(displayId: string) {
  const [status, setStatus] = useState<RemoteStatus>("connecting");
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [attempt, setAttempt] = useState(0);
  const connection = useRef<DataConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy = () => {};
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setStatus("connecting");

    void loadPeer().then((Peer) => {
      if (cancelled) return;
      const peer = new Peer(peerOptions);
      destroy = () => peer.destroy();

      peer.on("open", () => {
        const current = peer.connect(displayId, {
          reliable: true,
          serialization: "json",
        });
        const fail = () => {
          if (connection.current) return;
          clearTimeout(timeout);
          peer.destroy();
          setStatus("failed");
        };
        timeout = setTimeout(fail, connectTimeout);
        current.on("iceStateChanged", (state) => {
          if (state === "failed") fail();
        });
        current.on("open", () => {
          clearTimeout(timeout);
          connection.current = current;
          setStatus("connected");
        });
        current.on("data", (data) => {
          const update = readConfigMessage(data, "config");
          if (update) setConfig(update);
        });
        current.on("close", () => {
          connection.current = null;
          setStatus("disconnected");
        });
      });

      peer.on("error", (error) => {
        if (peer.destroyed) return;
        clearTimeout(timeout);
        connection.current = null;
        setStatus(
          error.type === "peer-unavailable" ? "unavailable" : "disconnected",
        );
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      connection.current = null;
      destroy();
    };
  }, [displayId, attempt]);

  const send = useCallback((update: DisplayConfig) => {
    connection.current?.send({
      type: "set-config",
      config: update,
    } satisfies ControllerMessage);
  }, []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { status, config, send, retry };
}
