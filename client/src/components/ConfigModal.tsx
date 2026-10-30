import { useEffect, useRef, useState } from "react";
import {
  allCharacterGroups,
  characterGroups,
  findUnsupportedCharacters,
  getCharset,
  layoutMessage,
} from "~/display/characters";
import type { CharacterGroup } from "~/display/characters";

export type DisplayConfig = {
  rows: number;
  columns: number;
  message: string;
  characterGroups: CharacterGroup[];
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

  const unsupported = findUnsupportedCharacters(
    draft.message,
    getCharset(draft.characterGroups),
  );
  const { overflow } = layoutMessage(
    draft.message,
    draft.rows || 1,
    draft.columns || 1,
  );

  const toggleGroup = (group: CharacterGroup, enabled: boolean) =>
    setDraft({
      ...draft,
      characterGroups: enabled
        ? [...draft.characterGroups, group]
        : draft.characterGroups.filter((other) => other !== group),
    });

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (unsupported.length > 0) return;
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

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1.5 text-neutral-400">Characters</legend>
          <label className="flex items-baseline gap-2 text-neutral-500">
            <input type="checkbox" checked disabled />
            <span>Space</span>
            <span className="ml-auto text-xs">always on</span>
          </label>
          {allCharacterGroups.map((group) => (
            <label key={group} className="flex items-baseline gap-2">
              <input
                type="checkbox"
                checked={draft.characterGroups.includes(group)}
                onChange={(event) => toggleGroup(group, event.target.checked)}
              />
              <span>{characterGroups[group].label}</span>
              <span className="ml-auto truncate font-mono text-xs text-neutral-500">
                {characterGroups[group].characters}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-400">Message</span>
          <textarea
            value={draft.message}
            onChange={(event) => {
              // Uppercase in place, keeping the caret where the user typed.
              const { selectionStart, selectionEnd } = event.target;
              const message = event.target.value.toUpperCase();
              event.target.value = message;
              event.target.setSelectionRange(selectionStart, selectionEnd);
              setDraft({ ...draft, message });
            }}
            rows={5}
            aria-invalid={unsupported.length > 0}
            aria-describedby="message-status"
            className="resize-y rounded-md bg-neutral-800 px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-neutral-500 aria-invalid:ring-2 aria-invalid:ring-red-500"
          />
          <span id="message-status" className="text-xs">
            {unsupported.length > 0 ? (
              <span className="text-red-400">
                Unsupported characters:{" "}
                {unsupported.map((character) => (
                  <kbd
                    key={character}
                    className="mx-0.5 rounded bg-neutral-800 px-1 font-mono"
                  >
                    {character}
                  </kbd>
                ))}
              </span>
            ) : overflow ? (
              <span className="text-amber-400">
                The message doesn't fit the grid and will be cut off.
              </span>
            ) : null}
          </span>
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
            disabled={unsupported.length > 0}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40"
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
