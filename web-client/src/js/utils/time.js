export function formatTime(timeStr) {
  if (!timeStr) return '-';
  const [hh, mm] = timeStr.split(':');
  if (hh && mm) return `${hh}:${mm}`;
  return timeStr;
}
