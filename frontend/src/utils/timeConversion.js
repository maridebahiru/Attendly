/**
 * Convert Ethiopian time to standard time (add 6 hours).
 * Can accept a Date object, an ISO string, or a "HH:MM" / "HH:MM:SS" time string.
 */
export function toStandardTime(timeInput) {
  if (!timeInput) return timeInput;

  if (timeInput instanceof Date) {
    const newDate = new Date(timeInput.getTime());
    newDate.setHours(newDate.getHours() + 6);
    return newDate;
  }

  // Check if it is a time-only string (HH:MM or HH:MM:SS)
  if (typeof timeInput === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeInput)) {
    const parts = timeInput.split(':');
    let hours = parseInt(parts[0], 10);
    hours = (hours + 6) % 24;
    parts[0] = String(hours).padStart(2, '0');
    return parts.join(':');
  }

  // Handle datetime strings
  try {
    const date = new Date(timeInput);
    if (!isNaN(date.getTime())) {
      date.setHours(date.getHours() + 6);
      if (typeof timeInput === 'string' && timeInput.includes('T')) {
        return date.toISOString().slice(0, 19);
      }
      return date;
    }
  } catch (e) {
    console.error("Error converting to standard time", e);
  }

  return timeInput;
}

/**
 * Convert standard time to Ethiopian time (subtract 6 hours).
 * Can accept a Date object, an ISO string, or a "HH:MM" / "HH:MM:SS" time string.
 */
export function toEthiopianTime(timeInput) {
  if (!timeInput) return timeInput;

  if (timeInput instanceof Date) {
    const newDate = new Date(timeInput.getTime());
    newDate.setHours(newDate.getHours() - 6);
    return newDate;
  }

  // Check if it is a time-only string (HH:MM or HH:MM:SS)
  if (typeof timeInput === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeInput)) {
    const parts = timeInput.split(':');
    let hours = parseInt(parts[0], 10);
    hours = (hours - 6 + 24) % 24;
    parts[0] = String(hours).padStart(2, '0');
    return parts.join(':');
  }

  // Handle datetime strings
  try {
    const date = new Date(timeInput);
    if (!isNaN(date.getTime())) {
      date.setHours(date.getHours() - 6);
      
      // Format to YYYY-MM-DDTHH:mm:ss without timezone offset (for datetime-local input)
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = date.getFullYear();
      const mm = pad(date.getMonth() + 1);
      const dd = pad(date.getDate());
      const hh = pad(date.getHours());
      const min = pad(date.getMinutes());
      const ss = pad(date.getSeconds());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
    }
  } catch (e) {
    console.error("Error converting to Ethiopian time", e);
  }

  return timeInput;
}
