import sqlite3
from datetime import datetime

def fix_labels():
    conn = sqlite3.connect('attendance.db')
    cursor = conn.cursor()
    
    # 1. Get all unique user_id and dates
    cursor.execute("SELECT DISTINCT user_id, date(timestamp) as log_date FROM attendance_logs ORDER BY user_id, log_date")
    user_dates = cursor.fetchall()
    
    print(f"Found {len(user_dates)} user-day combinations to check.")
    
    labels = ["Morning In", "Morning Out", "Afternoon In", "Afternoon Out"]
    
    updated_count = 0
    for user_id, log_date in user_dates:
        # Get all logs for this user on this day
        cursor.execute("""
            SELECT id FROM attendance_logs 
            WHERE user_id = ? AND date(timestamp) = ? 
            ORDER BY timestamp ASC
        """, (user_id, log_date))
        logs = cursor.fetchall()
        
        for i, (log_id,) in enumerate(logs):
            punch_label = labels[i] if i < len(labels) else f"Extra {i+1}"
            cursor.execute("UPDATE attendance_logs SET punch_label = ? WHERE id = ?", (punch_label, log_id))
            updated_count += 1
            
    conn.commit()
    conn.close()
    print(f"Finished. Updated {updated_count} records with labels.")

if __name__ == "__main__":
    fix_labels()
