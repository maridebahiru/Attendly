import sqlite3
import os

print("Starting DB migration...")
conn = sqlite3.connect('attendance.db')
cursor = conn.cursor()

# 1. Create new table
cursor.execute('''
CREATE TABLE attendance_logs_new (
    id INTEGER NOT NULL PRIMARY KEY, 
    user_id VARCHAR NOT NULL, 
    timestamp DATETIME NOT NULL, 
    original_timestamp DATETIME NOT NULL,
    punch_type VARCHAR NOT NULL, 
    verify_type INTEGER NOT NULL, 
    device_ip VARCHAR NOT NULL, 
    sync_status VARCHAR, 
    server_timestamp DATETIME,
    CONSTRAINT _user_original_timestamp_uc UNIQUE (user_id, original_timestamp),
    FOREIGN KEY(user_id) REFERENCES users (user_id)
)
''')

# 2. Copy data
cursor.execute('''
INSERT INTO attendance_logs_new (id, user_id, timestamp, original_timestamp, punch_type, verify_type, device_ip, sync_status, server_timestamp)
SELECT id, user_id, timestamp, timestamp, punch_type, verify_type, device_ip, sync_status, server_timestamp
FROM attendance_logs
''')

# 3. Drop old and rename
cursor.execute('DROP TABLE attendance_logs')
cursor.execute('ALTER TABLE attendance_logs_new RENAME TO attendance_logs')

# 4. Create indices
cursor.execute('CREATE INDEX ix_attendance_logs_id ON attendance_logs (id)')
cursor.execute('CREATE INDEX ix_attendance_logs_timestamp ON attendance_logs (timestamp)')
cursor.execute('CREATE INDEX ix_attendance_logs_original_timestamp ON attendance_logs (original_timestamp)')
cursor.execute('CREATE INDEX ix_attendance_logs_user_id ON attendance_logs (user_id)')

conn.commit()
conn.close()
print("Migration completed.")
