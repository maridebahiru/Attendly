import sqlite3

def upgrade():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE system_settings ADD COLUMN device_ip VARCHAR DEFAULT '192.168.10.40'")
        print("Successfully added device_ip to system_settings")
    except sqlite3.OperationalError as e:
        print(f"Error (maybe column exists?): {e}")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    upgrade()
