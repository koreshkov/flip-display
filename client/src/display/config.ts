import {
  allCharacterGroups,
  findUnsupportedCharacters,
  getCharset,
} from "./characters";
import type { CharacterGroup } from "./characters";

// Paint on the flaps; yellow as on airport departure boards.
export const letterColors = {
  white: { label: "White", value: "#f1eee4" },
  yellow: { label: "Yellow", value: "#f5c02c" },
} as const;
export type LetterColor = keyof typeof letterColors;

export type DisplayConfig = {
  rows: number;
  columns: number;
  message: string;
  characterGroups: CharacterGroup[];
  letterColor: LetterColor;
};

export const maxRows = 20;
export const maxColumns = 40;
const maxMessageLength = 2000;

export const defaultConfig: DisplayConfig = {
  rows: 5,
  columns: 13,
  // Every character on the drum; the alphabet fills exactly two rows.
  message: [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789",
    ".,:;!?'\"-/",
    "&@#$%+=()*",
  ].join("\n"),
  characterGroups: allCharacterGroups,
  letterColor: "white",
};

function clampInteger(value: unknown, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 1), max);
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
  const message =
    typeof value.message === "string"
      ? value.message.toUpperCase().slice(0, maxMessageLength)
      : "";
  if (findUnsupportedCharacters(message, getCharset(characterGroups)).length) {
    return null;
  }

  return {
    rows: clampInteger(value.rows, maxRows, defaultConfig.rows),
    columns: clampInteger(value.columns, maxColumns, defaultConfig.columns),
    message,
    characterGroups,
    letterColor:
      typeof value.letterColor === "string" &&
      Object.hasOwn(letterColors, value.letterColor)
        ? (value.letterColor as LetterColor)
        : defaultConfig.letterColor,
  };
}
