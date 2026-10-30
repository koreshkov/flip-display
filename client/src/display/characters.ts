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
export function layoutMessage(message: string, rows: number, columns: number) {
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
  const lines = Array.from({ length: rows }, (_, row) => {
    const line = visible[row - top] ?? "";
    const left = Math.floor((columns - line.length) / 2);
    return line.padStart(left + line.length).padEnd(columns);
  });

  return { lines, overflow: wrapped.length > rows };
}
