import sqlite3
import json

def migrate():
    conn = sqlite3.connect('c:/Users/Mar/Desktop/Finger print/attendance-system/backend/attendance.db')
    cursor = conn.cursor()
    
    try:
        # Add privileges column to admins table
        cursor.execute("ALTER TABLE admins ADD COLUMN privileges TEXT DEFAULT '[]'")
        print("Added privileges column to admins table.")
    except Exception as e:
        print(f"Privileges column already exists or error: {e}")
        
    # Update existing super_admin to have all privileges
    all_privileges = json.dumps(['dashboard', 'users', 'reports', 'logs', 'privileges', 'admins', 'settings'])
    cursor.execute("UPDATE admins SET privileges = ? WHERE role = 'super_admin'", (all_privileges,))
    
    # Update existing admins to have some default privileges if any
    admin_privileges = json.dumps(['dashboard', 'reports', 'logs'])
    cursor.execute("UPDATE admins SET privileges = ? WHERE role = 'admin'", (admin_privileges,))
    
    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
