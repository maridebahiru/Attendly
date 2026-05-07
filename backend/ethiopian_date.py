import math
from datetime import date, datetime

class EthiopianDate:
    def __init__(self, year, month, day):
        self.year = year
        self.month = month
        self.day = day

    def __repr__(self):
        return f"{self.year}-{self.month:02d}-{self.day:02d}"

    def to_isoformat(self):
        return f"{self.year}-{self.month:02d}-{self.day:02d}"

def gregorian_to_ethiopian(g_date: date) -> EthiopianDate:
    """
    Converts Gregorian date to Ethiopian date.
    """
    jdn = _gregorian_to_jdn(g_date.year, g_date.month, g_date.day)
    return _jdn_to_ethiopian(jdn)

def ethiopian_to_gregorian(year: int, month: int, day: int) -> date:
    """
    Converts Ethiopian date to Gregorian date.
    """
    jdn = _ethiopian_to_jdn(year, month, day)
    return _jdn_to_gregorian(jdn)

def _gregorian_to_jdn(year, month, day):
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + (a // 4)
    return int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + b - 1524

def _jdn_to_gregorian(jdn):
    jdn += 0.5
    z = int(jdn)
    f = jdn - z
    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - (alpha // 4)
    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)
    day = b - d - int(30.6001 * e) + f
    if e < 14:
        month = e - 1
    else:
        month = e - 13
    if month > 2:
        year = c - 4716
    else:
        year = c - 4715
    return date(int(year), int(month), int(day))

def _ethiopian_to_jdn(year, month, day):
    # Reference: 1-1-1 Ethiopian is JDN 1724221
    jdn = (year - 1) * 365 + (year // 4) + 30 * (month - 1) + day + 1724220
    return jdn

def _jdn_to_ethiopian(jdn):
    era = 1724221
    jdn = int(jdn)
    r = (jdn - era) % 1461
    n = (r % 365) + 365 * (r // 1460)
    year = 4 * ((jdn - era) // 1461) + (r // 365) - (r // 1460) + 1
    month = (n // 30) + 1
    day = (n % 30) + 1
    return EthiopianDate(int(year), int(month), int(day))


# Day names mapping for Ethiopian Calendar (usually aligned with Gregorian week)
ETHIOPIAN_DAY_NAMES = {
    0: "Monday",
    1: "Tuesday",
    2: "Wednesday",
    3: "Thursday",
    4: "Friday",
    5: "Saturday",
    6: "Sunday"
}
