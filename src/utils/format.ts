export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
