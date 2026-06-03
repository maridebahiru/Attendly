import sqlite3

def migrate():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    
    columns = [
        ('morning_in', 'VARCHAR DEFAULT "08:00"'),
        ('morning_out', 'VARCHAR DEFAULT "12:00"'),
        ('afternoon_in', 'VARCHAR DEFAULT "13:00"'),
        ('afternoon_out', 'VARCHAR DEFAULT "17:00"')
    ]
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE system_settings ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name}")
        except Exception as e:
            print(f"Column {col_name} might already exist: {e}")
            
    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
