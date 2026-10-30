import { useEffect, useRef } from "react";
import { ConfigForm } from "./ConfigForm";
import type { DisplayConfig } from "~/display/config";

type ConfigModalProps = {
  config: DisplayConfig;
  onSave: (config: DisplayConfig) => void;
  onClose: () => void;
};

export function ConfigModal({ config, onSave, onClose }: ConfigModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // A native modal dialog gives us the backdrop, focus trap and Escape key.
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl bg-neutral-900 p-6 text-neutral-100 shadow-2xl backdrop:bg-black/60"
    >
      <h2 className="mb-5 text-lg font-semibold">Configuration</h2>
      <ConfigForm
        config={config}
        onSubmit={(draft) => {
          onSave(draft);
          dialog.current?.close();
        }}
        onCancel={() => dialog.current?.close()}
      />
    </dialog>
  );
}
