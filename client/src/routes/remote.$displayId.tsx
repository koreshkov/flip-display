import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ConfigForm } from "~/components/ConfigForm";
import { useRemoteDisplay } from "~/display/useRemoteDisplay";
import type { RemoteStatus } from "~/display/useRemoteDisplay";

export const Route = createFileRoute("/remote/$displayId")({
  head: () => ({ meta: [{ title: "Flip Display Remote" }] }),
  component: RemotePage,
});

const statusLabels: Record<RemoteStatus, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  unavailable: "Display offline",
  failed: "Couldn't connect",
  disconnected: "Connection lost",
};

const failureMessages: Partial<Record<RemoteStatus, string>> = {
  unavailable:
    "The display isn't reachable. Make sure it's open, then try again.",
  failed:
    "The display was found, but no direct connection could be made. Check that both browsers may access the local network (on macOS: System Settings → Privacy & Security → Local Network). Devices on different networks need a TURN relay.",
  disconnected: "The connection to the display was lost.",
};

function RemotePage() {
  const { displayId } = Route.useParams();
  const { status, config, send, retry } = useRemoteDisplay(displayId);
  // Bumped on every update from the display, to reload the form with it.
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(config);
  const [saving, setSaving] = useState(false);

  if (config !== loaded) {
    setLoaded(config);
    setVersion((value) => value + 1);
    setSaving(false);
  }

  const failed = status !== "connecting" && status !== "connected";

  return (
    <main className="min-h-dvh bg-neutral-950 px-4 py-8 text-neutral-100">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">Flip Display</h1>
          <span
            role="status"
            data-status={status}
            className="flex items-center gap-2 text-sm text-neutral-400"
          >
            <span className="size-2 rounded-full bg-amber-400 in-data-[status=connected]:bg-emerald-400 in-data-[status=disconnected]:bg-red-400 in-data-[status=unavailable]:bg-red-400" />
            {statusLabels[status]}
          </span>
        </header>

        {failed && (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-neutral-900 p-6 text-sm text-neutral-300">
            <p>{failureMessages[status]}</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-md bg-neutral-100 px-4 py-2 font-medium text-neutral-900 hover:bg-white"
            >
              Try again
            </button>
          </div>
        )}

        {config ? (
          <div className="rounded-xl bg-neutral-900 p-6">
            <ConfigForm
              key={version}
              config={config}
              disabled={status !== "connected" || saving}
              submitLabel={saving ? "Saving…" : "Save"}
              onSubmit={(update) => {
                setSaving(true);
                send(update);
              }}
            />
          </div>
        ) : (
          !failed && (
            <p className="text-sm text-neutral-400">Waiting for the display…</p>
          )
        )}
      </div>
    </main>
  );
}
