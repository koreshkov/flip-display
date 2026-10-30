import { useId, useState } from "react";
import {
  allCharacterGroups,
  characterGroups,
  findUnsupportedCharacters,
  getCharset,
  layoutMessage,
} from "~/display/characters";
import type { Alignment, CharacterGroup } from "~/display/characters";
import {
  letterColors,
  maxColumns,
  maxInterval,
  maxMessages,
  maxRows,
} from "~/display/config";
import type { DisplayConfig, LetterColor, Message } from "~/display/config";

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
  const [draft, setDraft] = useState(config);

  const charset = getCharset(draft.characterGroups);
  const invalid = draft.messages.some(
    ({ text }) => findUnsupportedCharacters(text, charset).length > 0,
  );

  const setMessage = (index: number, message: Message) =>
    setDraft({
      ...draft,
      messages: draft.messages.map((other, i) =>
        i === index ? message : other,
      ),
    });
  const removeMessage = (index: number) =>
    setDraft({
      ...draft,
      messages: draft.messages.filter((_, other) => other !== index),
    });

  const toggleGroup = (group: CharacterGroup, enabled: boolean) =>
    setDraft({
      ...draft,
      characterGroups: enabled
        ? [...draft.characterGroups, group]
        : draft.characterGroups.filter((other) => other !== group),
    });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid || disabled) return;
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

      <div className="flex flex-col gap-4">
        {draft.messages.map((message, index) => (
          <MessageField
            key={index}
            label={
              draft.messages.length > 1 ? `Message ${index + 1}` : "Message"
            }
            value={message}
            charset={charset}
            rows={draft.rows || 1}
            columns={draft.columns || 1}
            onChange={(value) => setMessage(index, value)}
            onRemove={
              draft.messages.length > 1
                ? () => removeMessage(index)
                : undefined
            }
          />
        ))}
        {draft.messages.length < maxMessages && (
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                messages: [...draft.messages, { text: "", align: "center" }],
              })
            }
            className="self-start rounded-md px-3 py-1.5 text-sm text-neutral-300 ring-1 ring-neutral-700 hover:bg-neutral-800"
          >
            Add message
          </button>
        )}
      </div>

      {draft.messages.length > 1 && (
        <NumberField
          label="Seconds per message"
          value={draft.interval}
          max={maxInterval}
          onChange={(interval) => setDraft({ ...draft, interval })}
        />
      )}

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
          disabled={invalid || disabled}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const alignmentOptions: Record<Alignment, { label: string; icon: string }> = {
  left: { label: "Align left", icon: "M15 12H3M17 18H3M21 6H3" },
  center: { label: "Align center", icon: "M17 12H7M19 18H5M21 6H3" },
  right: { label: "Align right", icon: "M21 12H9M21 18H7M21 6H3" },
  justify: { label: "Edge to edge", icon: "M3 12h18M3 18h18M3 6h18" },
};

type MessageFieldProps = {
  label: string;
  value: Message;
  // Characters on the drum, to validate against.
  charset: string;
  rows: number;
  columns: number;
  onChange: (value: Message) => void;
  // Missing for the only message, which can't be removed.
  onRemove?: () => void;
};

function MessageField({
  label,
  value,
  charset,
  rows,
  columns,
  onChange,
  onRemove,
}: MessageFieldProps) {
  const id = useId();
  const unsupported = findUnsupportedCharacters(value.text, charset);
  const { overflow } = layoutMessage(value.text, rows, columns);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="mr-auto text-neutral-400">
          {label}
        </label>
        <div
          role="radiogroup"
          aria-label={`${label} alignment`}
          className="flex rounded-md bg-neutral-800 p-0.5"
        >
          {(Object.keys(alignmentOptions) as Alignment[]).map((align) => (
            <label
              key={align}
              title={alignmentOptions[align].label}
              className="cursor-pointer"
            >
              <input
                type="radio"
                name={`${id}-align`}
                value={align}
                checked={value.align === align}
                onChange={() => onChange({ ...value, align })}
                className="peer sr-only"
              />
              <span className="sr-only">{alignmentOptions[align].label}</span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-6 rounded p-1 text-neutral-400 transition hover:text-neutral-100 peer-checked:bg-neutral-600 peer-checked:text-neutral-100 peer-focus-visible:outline-2 peer-focus-visible:outline-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d={alignmentOptions[align].icon} />
              </svg>
            </label>
          ))}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="rounded px-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            Remove
          </button>
        )}
      </div>
      <textarea
        id={id}
        value={value.text}
        onChange={(event) => {
          // Uppercase in place, keeping the caret where the user typed.
          const { selectionStart, selectionEnd } = event.target;
          const text = event.target.value.toUpperCase();
          event.target.value = text;
          event.target.setSelectionRange(selectionStart, selectionEnd);
          onChange({ ...value, text });
        }}
        rows={4}
        aria-invalid={unsupported.length > 0}
        aria-describedby={`${id}-status`}
        className="resize-y rounded-md bg-neutral-800 px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-neutral-500 aria-invalid:ring-2 aria-invalid:ring-red-500"
      />
      <span id={`${id}-status`} className="text-xs">
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
    </div>
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
