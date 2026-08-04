import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
} from "date-fns";

export function dateLabel(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "h:mm a")}`;
  return format(date, "MMM d, yyyy");
}

export function relativeDayLabel(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const difference = differenceInCalendarDays(date, new Date());
  if (difference < 0) {
    const days = Math.abs(difference);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  return `In ${difference} days`;
}

export function elapsedLabel(value: string | null) {
  if (!value) return "No interactions yet";
  const days = differenceInCalendarDays(new Date(), new Date(value));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
