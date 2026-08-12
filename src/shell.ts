export function quoteForBash(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
