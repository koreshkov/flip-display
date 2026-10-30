import { useEffect, useRef, useState } from "react";
import type { DataConnection, Peer } from "peerjs";
import type { DisplayConfig } from "./config";
import { getDisplayId, loadPeer, peerOptions, readConfigMessage } from "./peer";
import type { DisplayMessage } from "./peer";

export type DisplayPeerStatus = "connecting" | "online" | "offline" | "taken";

// The signaling server may still hold our ID for a moment after a reload,
// so retry this many times before deciding another tab really has it.
const takenRetries = 5;
const retryDelay = 2000;

// Makes the display reachable by remote controllers under a stable ID.
// Remote configs are validated before they reach `onRemoteConfig`, and every
// config change is pushed to all connected controllers.
export function useDisplayPeer(
  config: DisplayConfig,
  onRemoteConfig: (config: DisplayConfig) => void,
) {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [status, setStatus] = useState<DisplayPeerStatus>("connecting");
  const [controllers, setControllers] = useState(0);
  const connections = useRef(new Set<DataConnection>());
  const latest = useRef({ config, onRemoteConfig });
  latest.current = { config, onRemoteConfig };

  useEffect(() => {
    let peer: Peer | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let takenAttempts = 0;
    const id = getDisplayId();
    setPeerId(id);

    const send = (connection: DataConnection) =>
      connection.send({
        type: "config",
        config: latest.current.config,
      } satisfies DisplayMessage);

    const retry = (action: () => void) => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => !cancelled && action(), retryDelay);
    };

    const connect = async () => {
      const Peer = await loadPeer();
      if (cancelled) return;
      setStatus("connecting");
      const current = new Peer(id, peerOptions);
      peer = current;

      current.on("open", () => {
        takenAttempts = 0;
        setStatus("online");
      });

      current.on("disconnected", () => {
        if (current.destroyed) return;
        setStatus("offline");
        retry(() => current.reconnect());
      });

      current.on("error", (error) => {
        if (error.type === "unavailable-id") {
          current.destroy();
          if (++takenAttempts > takenRetries) setStatus("taken");
          else retry(connect);
        } else if (
          ["network", "server-error", "socket-error", "socket-closed"].includes(
            error.type,
          )
        ) {
          setStatus("offline");
          retry(() => current.reconnect());
        }
      });

      current.on("connection", (connection) => {
        const remove = () => {
          connections.current.delete(connection);
          setControllers(connections.current.size);
        };
        connection.on("open", () => {
          connections.current.add(connection);
          setControllers(connections.current.size);
          send(connection);
        });
        connection.on("data", (data) => {
          const remote = readConfigMessage(data, "set-config");
          if (remote) latest.current.onRemoteConfig(remote);
        });
        connection.on("close", remove);
        connection.on("error", remove);
      });
    };

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      peer?.destroy();
      connections.current.clear();
      setControllers(0);
    };
  }, []);

  // Keep every controller's form in sync, including the one that saved.
  useEffect(() => {
    for (const connection of connections.current) {
      connection.send({ type: "config", config } satisfies DisplayMessage);
    }
  }, [config]);

  return { peerId, status, controllers };
}
