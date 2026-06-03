import sqlite3

def migrate():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN password VARCHAR")
    except Exception as e:
        print(f"Password column already exists or error: {e}")
        
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'")
    except Exception as e:
        print(f"Role column already exists or error: {e}")
        
    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
