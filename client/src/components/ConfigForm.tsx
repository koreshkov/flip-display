import { useId, useState } from "react";
import {
  allCharacterGroups,
  characterGroups,
  findUnsupportedCharacters,
  getCharset,
  layoutMessage,
} from "~/display/characters";
import type { CharacterGroup } from "~/display/characters";
import { letterColors, maxColumns, maxRows } from "~/display/config";
import type { DisplayConfig, LetterColor } from "~/display/config";

type ConfigFormProps = {
  // Initial values; remount the form (via `key`) to load new ones.
  config: DisplayConfig;
  onSubmit: (config: DisplayConfig) => void;
  onCancel?: () => void;
  submitLabel?: string;
  // Disables submitting, e.g. while the remote display is offline.
  disabled?: boolean;
};

export function ConfigForm({
  config,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  disabled = false,
}: ConfigFormProps) {
  const statusId = useId();
  const [draft, setDraft] = useState(config);

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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (unsupported.length > 0 || disabled) return;
    onSubmit(draft);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
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

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1.5 text-neutral-400">Letter color</legend>
        <div className="flex gap-3">
          {(Object.keys(letterColors) as LetterColor[]).map((color) => (
            <label
              key={color}
              title={letterColors[color].label}
              style={
                { "--swatch": letterColors[color].value } as React.CSSProperties
              }
            >
              <input
                type="radio"
                name="letterColor"
                value={color}
                checked={draft.letterColor === color}
                onChange={() => setDraft({ ...draft, letterColor: color })}
                className="peer sr-only"
              />
              <span className="sr-only">{letterColors[color].label}</span>
              <span
                aria-hidden="true"
                className="block size-7 cursor-pointer rounded-full bg-(--swatch) ring-2 ring-transparent ring-offset-2 ring-offset-neutral-900 transition peer-checked:ring-(--swatch) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-6 peer-focus-visible:outline-white"
              />
            </label>
          ))}
        </div>
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
          aria-describedby={statusId}
          className="resize-y rounded-md bg-neutral-800 px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-neutral-500 aria-invalid:ring-2 aria-invalid:ring-red-500"
        />
        <span id={statusId} className="text-xs">
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
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={unsupported.length > 0 || disabled}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
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
