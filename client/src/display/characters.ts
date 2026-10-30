export const characterGroups = {
  letters: { label: "Letters", characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  digits: { label: "Digits", characters: "0123456789" },
  punctuation: { label: "Punctuation", characters: ".,:;!?'\"-/" },
  symbols: { label: "Symbols", characters: "&@#$%+=()*" },
} as const;

export type CharacterGroup = keyof typeof characterGroups;

export const allCharacterGroups = Object.keys(
  characterGroups,
) as CharacterGroup[];

// The order of characters on each segment's drum. Space is the blank flap,
// always present and always first.
export function getCharset(groups: readonly CharacterGroup[]) {
  return (
    " " +
    allCharacterGroups
      .filter((group) => groups.includes(group))
      .map((group) => characterGroups[group].characters)
      .join("")
  );
}

export function findUnsupportedCharacters(message: string, charset: string) {
  const unsupported = [...message].filter(
    (character) => character !== "\n" && !charset.includes(character),
  );
  return [...new Set(unsupported)];
}

// Word-wraps the message to the grid and centers it both ways. Returns one
// string per row, each exactly `columns` long.
export const alignments = ["left", "center", "right", "justify"] as const;
// "justify" puts the first and last word at the row edges and spreads the
// words evenly in between; a lone word stays on the left.
export type Alignment = (typeof alignments)[number];

function alignLine(line: string, columns: number, align: Alignment) {
  const words = line.split(" ");
  if (align === "justify" && words.length > 1) {
    const gaps = words.length - 1;
    const spaces = columns - words.join("").length;
    return words
      .map((word, index) => {
        if (index === gaps) return word;
        // Earlier gaps take the spaces that don't divide evenly.
        const gap = Math.floor(spaces / gaps) + (index < spaces % gaps ? 1 : 0);
        return word + " ".repeat(gap);
      })
      .join("");
  }
  if (align === "right") return line.padStart(columns);
  if (align === "center") {
    const left = Math.floor((columns - line.length) / 2);
    return line.padStart(left + line.length).padEnd(columns);
  }
  return line.padEnd(columns);
}

export function layoutMessage(
  message: string,
  rows: number,
  columns: number,
  align: Alignment = "center",
) {
  const wrapped: string[] = [];
  const text = message.trim();

  for (const paragraph of text ? text.split("\n") : []) {
    let line = "";
    for (let word of paragraph.split(" ").filter(Boolean)) {
      // A word longer than a row gets split across rows.
      while (word.length > columns) {
        if (line) wrapped.push(line);
        line = "";
        wrapped.push(word.slice(0, columns));
        word = word.slice(columns);
      }
      if (!word) continue;
      if (!line) {
        line = word;
      } else if (line.length + 1 + word.length <= columns) {
        line += " " + word;
      } else {
        wrapped.push(line);
        line = word;
      }
    }
    wrapped.push(line);
  }

  const visible = wrapped.slice(0, rows);
  const top = Math.floor((rows - visible.length) / 2);
  const lines = Array.from({ length: rows }, (_, row) =>
    alignLine(visible[row - top] ?? "", columns, align),
  );

  return { lines, overflow: wrapped.length > rows };
}
