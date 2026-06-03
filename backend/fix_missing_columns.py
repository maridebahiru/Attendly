import sqlite3

def migrate():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    
    print("Migrating attendance_logs table...")
    
    # Add punch_label
    try:
        cursor.execute("ALTER TABLE attendance_logs ADD COLUMN punch_label VARCHAR")
        print("Added punch_label to attendance_logs")
    except Exception as e:
        print(f"punch_label already exists or error: {e}")
        
    # Add edited_by
    try:
        cursor.execute("ALTER TABLE attendance_logs ADD COLUMN edited_by VARCHAR")
        print("Added edited_by to attendance_logs")
    except Exception as e:
        print(f"edited_by already exists or error: {e}")
        
    # Add edited_at
    try:
        cursor.execute("ALTER TABLE attendance_logs ADD COLUMN edited_at DATETIME")
        print("Added edited_at to attendance_logs")
    except Exception as e:
        print(f"edited_at already exists or error: {e}")
        
    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
