import math
from datetime import date, datetime

class EthiopianDate:
    def __init__(self, year, month, day):
        self.year = year
        self.month = month
        self.day = day
    def __repr__(self):
        return f"{self.year}-{self.month:02d}-{self.day:02d}"

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

def test():
    g = date(2026, 5, 7)
    jdn = _gregorian_to_jdn(g.year, g.month, g.day)
    eth = _jdn_to_ethiopian(jdn)
    print(f"Gregorian: {g} -> JDN: {jdn} -> Ethiopian: {eth}")
    
    jdn2 = _ethiopian_to_jdn(eth.year, eth.month, eth.day)
    g2 = _jdn_to_gregorian(jdn2)
    print(f"Ethiopian: {eth} -> JDN: {jdn2} -> Gregorian: {g2}")
    
    # Check Today (May 7 2024 is usually near Miazia 29 2016?)
    # May 7 2026 should be near Miazia 29 2018?
    # Actually May 7 is Megabit? No.
    # Sept 11 2023 = Meskerem 1 2016.
    # May 7 2024 is about 8 months after Sept 2023.
    # Meskerem(1), Tikimt(2), Hidar(3), Tahsas(4), Tir(5), Yekatit(6), Megabit(7), Miazia(8), Ginbot(9)
    # May 7 is around Miazia 29.
    
if __name__ == "__main__":
    test()
