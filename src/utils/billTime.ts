// bill posts from America/New_York. The site's timestamps ("8.24.26  7:28 pm")
// carry no timezone info, so we treat them as NY wall-clock time and convert
// to the device's local timezone for display.
const BILL_TZ = 'America/New_York';

// Reads an instant's wall-clock date/time in a given zone as plain numbers
// (via formatToParts, never a string round-tripped through `new Date(...)`
// — Hermes doesn't reliably parse locale-formatted date strings, unlike V8).
function partsAsUTCMillis(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // some locales format midnight as "24" with hour12:false
  return Date.UTC(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1,
    parseInt(get('day'), 10),
    hour,
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10)
  );
}

function tzOffsetMinutes(instant: Date, timeZone: string): number {
  return (partsAsUTCMillis(instant, 'UTC') - partsAsUTCMillis(instant, timeZone)) / 60000;
}

function parseBillDate(dateStr: string): Date | null {
  const m = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\D+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  const [, moStr, dayStr, yrStr, hStr, minStr, ampm] = m;
  const month = parseInt(moStr, 10);
  const day = parseInt(dayStr, 10);
  let year = parseInt(yrStr, 10);
  if (year < 100) year += 2000;
  let hour = parseInt(hStr, 10) % 12;
  if (ampm.toLowerCase() === 'pm') hour += 12;
  const minute = parseInt(minStr, 10);

  // Guess the instant by treating the wall-clock numbers as UTC, then correct
  // by NY's actual offset at that date (handles EST/EDT automatically).
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (isNaN(guess.getTime())) return null;
  const offsetMin = tzOffsetMinutes(guess, BILL_TZ);
  return new Date(guess.getTime() + offsetMin * 60000);
}

// Returns "(h:mm am/pm your time)" for a bill-posted timestamp, or '' if it
// can't be parsed or the device is already on bill's timezone.
export function localTimeSuffix(dateStr?: string): string {
  if (!dateStr) return '';
  let deviceTz: string;
  try {
    deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
  if (deviceTz === BILL_TZ) return '';

  const instant = parseBillDate(dateStr);
  if (!instant || isNaN(instant.getTime())) return '';

  let local: string;
  try {
    local = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
      .format(instant)
      .toLowerCase();
  } catch {
    return '';
  }
  return `(${local} your time)`;
}

// Permalink for one entry. The site addresses each question by its posted
// wall-clock time as q.php?date=YYYYMMDDHHMM (24h, no timezone conversion).
export function questionUrl(dateStr?: string): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\D+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  const [, mo, day, yr, h, min, ampm] = m;
  const year = yr.length === 2 ? '20' + yr : yr;
  let hour = parseInt(h, 10) % 12;
  if (ampm.toLowerCase() === 'pm') hour += 12;
  const p2 = (n: string | number) => String(n).padStart(2, '0');
  return `https://billwurtz.com/questions/q.php?date=${year}${p2(mo)}${p2(day)}${p2(hour)}${min}`;
}
