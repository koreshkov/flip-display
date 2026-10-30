import { useEffect, useRef, useState } from "react";

export type DisplayConfig = {
  rows: number;
  columns: number;
  message: string;
};

const maxRows = 20;
const maxColumns = 40;

type ConfigModalProps = {
  config: DisplayConfig;
  onSave: (config: DisplayConfig) => void;
  onClose: () => void;
};

export function ConfigModal({ config, onSave, onClose }: ConfigModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(config);

  // A native modal dialog gives us the backdrop, focus trap and Escape key.
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/60"
    >
      <form onSubmit={save} className="flex flex-col gap-5 p-6">
        <h2 className="text-lg font-semibold">Configuration</h2>

        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Rows"
            value={draft.rows}
            max={maxRows}
            onChange={(rows) => setDraft({ ...draft, rows })}
          />
          <NumberField
            label="Columns"
            value={draft.columns}
            max={maxColumns}
            onChange={(columns) => setDraft({ ...draft, columns })}
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">Message</span>
          <textarea
            value={draft.message}
            onChange={(event) =>
              setDraft({ ...draft, message: event.target.value })
            }
            rows={5}
            className="resize-y rounded-md bg-neutral-800 px-3 py-2 font-mono uppercase outline-none focus:ring-2 focus:ring-neutral-500"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-md px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
};

function NumberField({ label, value, max, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-400">{label}</span>
      <input
        type="number"
        required
        min={1}
        max={max}
        step={1}
        value={value || ""}
        onChange={(event) => onChange(event.target.valueAsNumber || 0)}
        className="rounded-md bg-neutral-800 px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-neutral-500"
      />
    </label>
  );
}
