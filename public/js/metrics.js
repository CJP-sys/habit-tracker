const iso = (date) => date.toISOString().slice(0, 10);
const atNoon = (value) => {
  const date = value ? new Date(value + "T12:00:00") : new Date();
  date.setHours(12, 0, 0, 0);
  return date;
};
export function isScheduled(habit, dateValue) {
  const day = atNoon(dateValue).getDay();
  return habit.frequency !== "weekdays" || (day !== 0 && day !== 6);
}
export function dateRange(days, end = new Date()) {
  const values = [];
  const cursor = atNoon(iso(end));
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - index);
    values.push(iso(date));
  }
  return values;
}
export function habitStats(habit, end = new Date()) {
  const endDate = atNoon(iso(end));
  let current = 0,
    best = 0,
    run = 0,
    total = 0,
    scheduled = 0;
  const start = atNoon(habit.startDate);
  const cursor = new Date(start);
  while (cursor <= endDate) {
    const key = iso(cursor);
    if (isScheduled(habit, key)) {
      scheduled += 1;
      if (habit.completions[key]) {
        total += 1;
        run += 1;
        best = Math.max(best, run);
      } else run = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const streakCursor = new Date(endDate);
  while (streakCursor >= start) {
    const key = iso(streakCursor);
    if (isScheduled(habit, key)) {
      if (habit.completions[key]) current += 1;
      else if (key !== iso(endDate)) break;
      else break;
    }
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  return {
    current,
    best,
    total,
    rate: scheduled ? Math.round((total / scheduled) * 100) : 0,
  };
}
export function rateForDates(habits, dates) {
  let done = 0,
    total = 0;
  dates.forEach((date) =>
    habits
      .filter((h) => !h.archived && isScheduled(h, date) && date >= h.startDate)
      .forEach((h) => {
        total += 1;
        if (h.completions[date]) done += 1;
      }),
  );
  return total ? Math.round((done / total) * 100) : 0;
}
export function dailyRates(habits, dates) {
  return dates.map((date) => ({ date, rate: rateForDates(habits, [date]) }));
}
export function overallSummary(habits) {
  const active = habits.filter((h) => !h.archived);
  const today = iso(new Date());
  const todayDone = active.filter((h) => h.completions[today]).length;
  const stats = active.map((h) => ({ ...habitStats(h), habit: h }));
  return {
    active,
    todayDone,
    current: Math.max(0, ...stats.map((s) => s.current)),
    best: Math.max(0, ...stats.map((s) => s.best)),
    monthRate: rateForDates(active, dateRange(30)),
    stats,
  };
}
