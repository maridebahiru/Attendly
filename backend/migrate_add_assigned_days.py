import sqlite3

print("Adding assigned_days column to shifts table...")
conn = sqlite3.connect('attendance.db')
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE shifts ADD COLUMN assigned_days VARCHAR")
    conn.commit()
    print("Column added successfully.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e) or "already exists" in str(e):
        print("Column already exists.")
    else:
        print(f"Error: {e}")

conn.close()
