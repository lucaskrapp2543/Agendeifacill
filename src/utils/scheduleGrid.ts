export function getScheduleIntervalMinutes(config: {
  use60MinuteSchedule?: boolean | null;
  use20MinuteSchedule?: boolean | null;
  use15MinuteInterval?: boolean | null;
}): number {
  if (Boolean(config.use60MinuteSchedule)) return 60;
  if (Boolean(config.use20MinuteSchedule)) return 20;
  if (Boolean(config.use15MinuteInterval)) return 30;
  return 15;
}

export function getTimeMinutePart(time: unknown): number | null {
  const [, minutesRaw = ''] = String(time ?? '').trim().split(':');
  const minutes = Number(minutesRaw);
  return Number.isFinite(minutes) ? minutes : null;
}

export function isTimeAlignedToScheduleGrid(time: unknown, intervalMinutes: number): boolean {
  const minutes = getTimeMinutePart(time);
  if (minutes == null) return false;
  const interval = Math.max(1, Number(intervalMinutes || 15));
  return minutes % interval === 0;
}

export function filterTimesAlignedToScheduleGrid(times: unknown[], intervalMinutes: number): string[] {
  if (!Array.isArray(times)) return [];
  return times
    .map((time) => String(time ?? '').trim())
    .filter((time) => time && isTimeAlignedToScheduleGrid(time, intervalMinutes));
}
