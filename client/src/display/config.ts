import {
  alignments,
  allCharacterGroups,
  findUnsupportedCharacters,
  getCharset,
} from "./characters";
import type { Alignment, CharacterGroup } from "./characters";

// Paint on the flaps; yellow as on airport departure boards.
export const letterColors = {
  white: { label: "White", value: "#f1eee4" },
  yellow: { label: "Yellow", value: "#f5c02c" },
} as const;
export type LetterColor = keyof typeof letterColors;

export type Message = {
  text: string;
  align: Alignment;
};

export type DisplayConfig = {
  rows: number;
  columns: number;
  // Shown in turn; each stays `interval` seconds once every flap has landed.
  messages: Message[];
  interval: number;
  characterGroups: CharacterGroup[];
  letterColor: LetterColor;
};

export const maxRows = 20;
export const maxColumns = 40;
export const maxMessages = 20;
export const maxInterval = 3600;
const maxMessageLength = 2000;

export const defaultConfig: DisplayConfig = {
  rows: 5,
  columns: 13,
  // Every character on the drum; the alphabet fills exactly two rows.
  messages: [
    {
      text: [
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "0123456789",
        ".,:;!?'\"-/",
        "&@#$%+=()*",
      ].join("\n"),
      align: "center",
    },
    {
      text: ["HELLO, WORLD!"].join("\n"),
      align: "center",
    },
  ],
  interval: 10,
  characterGroups: allCharacterGroups,
  letterColor: "white",
};

function clampInteger(value: unknown, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 1), max);
}

function sanitizeMessage(input: unknown): Message | null {
  const { text, align } =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : { text: input, align: undefined };
  if (typeof text !== "string") return null;
  return {
    text: text.toUpperCase().slice(0, maxMessageLength),
    align: alignments.includes(align as Alignment)
      ? (align as Alignment)
      : "center",
  };
}

// Turns untrusted input (e.g. from a remote controller) into a valid config,
// or null when it cannot be shown as is.
export function sanitizeConfig(input: unknown): DisplayConfig | null {
  if (typeof input !== "object" || input === null) return null;
  const value = input as Record<string, unknown>;

  const characterGroups = allCharacterGroups.filter(
    (group) =>
      Array.isArray(value.characterGroups) &&
      value.characterGroups.includes(group),
  );
  // Older controllers send a single `message`, or messages as plain text.
  const received: unknown[] = Array.isArray(value.messages)
    ? value.messages
    : [value.message];
  const messages = received
    .map(sanitizeMessage)
    .filter((message) => message !== null)
    .slice(0, maxMessages);
  const charset = getCharset(characterGroups);
  if (
    messages.some(
      ({ text }) => findUnsupportedCharacters(text, charset).length > 0,
    )
  ) {
    return null;
  }

  return {
    rows: clampInteger(value.rows, maxRows, defaultConfig.rows),
    columns: clampInteger(value.columns, maxColumns, defaultConfig.columns),
    messages: messages.length > 0 ? messages : [{ text: "", align: "center" }],
    interval: clampInteger(value.interval, maxInterval, defaultConfig.interval),
    characterGroups,
    letterColor:
      typeof value.letterColor === "string" &&
      Object.hasOwn(letterColors, value.letterColor)
        ? (value.letterColor as LetterColor)
        : defaultConfig.letterColor,
  };
}
