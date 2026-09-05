/** Runtime-neutral helpers for Android/Hermes critical paths. */
export function lastItem<T>(items: readonly T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

export function leftPad(value: string | number, width: number, fill = '0'): string {
  const text = String(value);
  if (text.length >= width || width <= 0) return text;
  const token = fill || ' ';
  let prefix = '';
  while (prefix.length < width - text.length) prefix += token;
  return `${prefix.slice(0, width - text.length)}${text}`;
}
