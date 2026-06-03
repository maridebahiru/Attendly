import sqlite3

def migrate():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    
    try:
        print("Adding 'privilege' column to 'users' table...")
        cursor.execute("ALTER TABLE users ADD COLUMN privilege INTEGER DEFAULT 0")
        conn.commit()
        print("Column added successfully.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'privilege' already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
