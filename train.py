import os
import cv2
import face_recognition
import pickle
import pandas as pd
import numpy as np
import mysql.connector as mysql

# ----------------------------
# Paths
# ----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STUDENTS_DIR = os.path.join(BASE_DIR, "Students")
STUDENTS_CSV = os.path.join(BASE_DIR, "students.csv")
ENCODINGS_PATH = os.path.join(BASE_DIR, "encodings.pkl")

# ----------------------------
# Database configuration & Connection
# ----------------------------
def get_db_connection():
    env_path = os.path.join(BASE_DIR, ".env")
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    env_vars[key] = val

    host = os.environ.get('DB_HOST', env_vars.get('DB_HOST', 'localhost'))
    port = int(os.environ.get('DB_PORT', env_vars.get('DB_PORT', 3306)))
    user = os.environ.get('DB_USER', env_vars.get('DB_USER', 'root'))
    password = os.environ.get('DB_PASS', env_vars.get('DB_PASS', ''))
    database = os.environ.get('DB_NAME', env_vars.get('DB_NAME', 'smart_attendance'))

    return mysql.connect(host=host, port=port, user=user, password=password, database=database)

# ----------------------------
# Load Student Data from Database
# ----------------------------
valid_names = set()
students_info = {}
try:
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, name, roll_no, department, class as class_name, year, division FROM students")
    students_data = cursor.fetchall()
    
    # Create lookup dictionary: roll_no -> student info (roll_no is unique)
    for s in students_data:
        students_info[s['roll_no']] = s
        valid_names.add(s['name'])
        
    print(f"[INFO] Connected to Aiven Cloud DB. Loaded {len(students_data)} students.")
except Exception as e:
    print(f"[ERROR] Failed to load from database: {e}")
    exit(1)

# ----------------------------
# Prepare Encodings with Class Information
# ----------------------------
print("[INFO] Training started. Reading images from local disk and saving to Cloud DB...")

db = get_db_connection()
cursor = db.cursor()

# Walk through hierarchical structure: Students/Department/Year/Division/StudentName/images/
for root, dirs, files in os.walk(STUDENTS_DIR):
    if files and any(f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')) for f in files):
        path_parts = root.replace(STUDENTS_DIR, '').strip(os.sep).split(os.sep)
        
        if path_parts[-1].lower() == 'images' and len(path_parts) >= 2:
            student_name = path_parts[-2]
            path_parts = path_parts[:-1]
        else:
            student_name = path_parts[-1]
        
        if student_name not in valid_names:
            print(f"[WARNING] '{student_name}' folder does not match any Name in DB!")
            continue
            
        student_encodings = []
        for img_name in files:
            if not img_name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')):
                continue
                
            img_path = os.path.join(root, img_name)
            img = cv2.imread(img_path)
            if img is None: continue
            
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            boxes = face_recognition.face_locations(rgb_img)
            encodings = face_recognition.face_encodings(rgb_img, boxes)
            student_encodings.extend(encodings)

        if student_encodings:
            baseline = np.mean(student_encodings, axis=0)
            # Serialize the encoding array to base64 string so it fits safely in MEDIUMTEXT
            encoding_data = base64.b64encode(pickle.dumps(baseline)).decode('utf-8')
            
            try:
                # Update specific student in the cloud database
                cursor.execute("""
                    UPDATE students 
                    SET face_encoding = %s 
                    WHERE name = %s AND face_encoding IS NULL
                """, (encoding_data, student_name))
                
                # if rows untouched, it might already exist, so update anyway to refresh it
                if cursor.rowcount == 0:
                    cursor.execute("""
                        UPDATE students 
                        SET face_encoding = %s 
                        WHERE name = %s
                    """, (encoding_data, student_name))
                    
                db.commit()
                print(f"[INFO] Cloud DB updated with baseline encoding for {student_name}")
            except Exception as e:
                print(f"[ERROR] Failed to save {student_name} to Cloud DB: {e}")

cursor.close()
db.close()
print("\n[INFO] Cloud Training completed successfully! All encodings are stored in Aiven.")
