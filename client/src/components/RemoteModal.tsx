import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getRemoteUrl } from "~/display/peer";
import type { DisplayPeerStatus } from "~/display/useDisplayPeer";

type RemoteModalProps = {
  peerId: string | null;
  status: DisplayPeerStatus;
  controllers: number;
  onClose: () => void;
};

const statusLabels: Record<DisplayPeerStatus, string> = {
  connecting: "Connecting to the signaling server…",
  online: "Ready for remote control",
  offline: "Signaling server unreachable, retrying…",
  taken: "This display is already open in another tab or window.",
};

export function RemoteModal({
  peerId,
  status,
  controllers,
  onClose,
}: RemoteModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = peerId ? getRemoteUrl(peerId) : null;
  // A phone can't reach this machine through "localhost".
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void QRCode.toString(url, { type: "svg", margin: 2 }).then((svg) => {
      if (!cancelled) {
        setQrCode(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
      className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-xl bg-neutral-900 p-6 text-neutral-100 shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Remote control</h2>
        <p className="text-sm text-neutral-400">
          Scan with another device to configure this display.
        </p>

        <div className="aspect-square w-full overflow-hidden rounded-lg bg-white">
          {qrCode && status !== "taken" && (
            <img
              src={qrCode}
              alt="QR code linking to the remote configuration page"
              className="size-full"
            />
          )}
        </div>

        {url && (
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-400 hover:text-neutral-200"
            >
              {url}
            </a>
            <button
              type="button"
              onClick={copy}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        <p
          role="status"
          className={`text-sm ${status === "online" ? "text-emerald-400" : status === "taken" ? "text-red-400" : "text-amber-400"}`}
        >
          {statusLabels[status]}
          {status === "online" && controllers > 0 && (
            <span className="text-neutral-400">
              {" "}
              · {controllers} {controllers === 1 ? "device" : "devices"}{" "}
              connected
            </span>
          )}
        </p>

        {local && (
          <p className="text-xs text-amber-400">
            This page is open on localhost, which other devices can't reach.
            Open the display through this computer's network address instead.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
