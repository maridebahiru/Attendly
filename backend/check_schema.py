import sqlite3

def check():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(attendance_logs)")
    columns = cursor.fetchall()
    print("Columns in attendance_logs:")
    for col in columns:
        print(col)
    
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    print("\nColumns in users:")
    for col in columns:
        print(col)
    
    conn.close()

if __name__ == "__main__":
    check()
