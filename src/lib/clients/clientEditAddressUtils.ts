export function splitStreetLine(line: string): { street: string; houseNumber: string } {
  const trimmed = line.trim();
  if (!trimmed) return { street: '', houseNumber: '' };

  const match = trimmed.match(/^(.+?)\s+(\d[\w\-/]*)$/);
  if (match) {
    return { street: match[1].trim(), houseNumber: match[2].trim() };
  }

  return { street: trimmed, houseNumber: '' };
}
