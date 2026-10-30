import { useEffect, useState } from "react";

// Hide the actions after this long without any pointer or keyboard input.
const idleTimeout = 5000;

type OverlayProps = {
  onOpenConfig: () => void;
  onOpenRemote: () => void;
};

export function Overlay({ onOpenConfig, onOpenRemote }: OverlayProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), idleTimeout);
    };
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    wake();
    events.forEach((event) => window.addEventListener(event, wake));
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, wake));
    };
  }, []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement !== null);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  return (
    <div
      data-idle={idle || undefined}
      className="group pointer-events-none fixed inset-0 flex items-start justify-end gap-2 p-4 transition-opacity duration-500 data-idle:not-focus-within:opacity-0"
    >
      <OverlayButton
        label={fullscreen ? "Exit full screen" : "Enter full screen"}
        onClick={toggleFullscreen}
      >
        {fullscreen ? (
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        ) : (
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        )}
      </OverlayButton>
      <OverlayButton label="Remote control" onClick={onOpenRemote}>
        <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 19h2v2h-2zM15 19h2M19 15h2" />
      </OverlayButton>
      <OverlayButton label="Configure" onClick={onOpenConfig}>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
      </OverlayButton>
    </div>
  );
}

type OverlayButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function OverlayButton({ label, onClick, children }: OverlayButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto rounded-lg group-data-idle:group-not-focus-within:pointer-events-none bg-black/40 p-2 text-neutral-200 backdrop-blur transition hover:bg-black/60 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
