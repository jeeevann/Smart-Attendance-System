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

# Database configuration
DB_HOST = 'localhost'
DB_NAME = 'smart_attendance'
DB_USER = 'root'
DB_PASS = ''

# ----------------------------
# Load Student Data from Database
# ----------------------------
try:
    db = mysql.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT name, roll_no, department, class, year, division FROM students")
    students_data = cursor.fetchall()
    
    # Create lookup dictionary: name -> student info
    students_info = {s['name']: s for s in students_data}
    valid_names = set(students_info.keys())
    
    cursor.close()
    db.close()
    print(f"[INFO] Loaded {len(students_info)} students from database")
except Exception as e:
    print(f"[ERROR] Failed to load from database: {e}")
    print("[INFO] Falling back to CSV...")
    students_df = pd.read_csv(STUDENTS_CSV)
    valid_names = set(students_df["Name"].values)
    students_info = {}

# ----------------------------
# Clean up old encodings if they exist
# ----------------------------
if os.path.exists(ENCODINGS_PATH):
    try:
        with open(ENCODINGS_PATH, "rb") as f:
            old_data = pickle.load(f)
            if len(old_data) == 4:
                old_known_encodings, old_known_names, old_baseline_encodings, old_student_class_info = old_data
            else:
                old_known_encodings, old_known_names, old_baseline_encodings = old_data
                old_student_class_info = {}
        
        old_students = set(old_known_names)
        current_students = valid_names
        deleted_students = old_students - current_students
        
        if deleted_students:
            print(f"[INFO] Detected {len(deleted_students)} deleted student(s): {deleted_students}")
            print("[INFO] Old encodings will be cleaned up...")
        else:
            print("[INFO] No deleted students detected.")
    except Exception as e:
        print(f"[WARNING] Could not read old encodings: {e}")

# ----------------------------
# Prepare Encodings with Class Information
# ----------------------------
known_encodings = []
known_names = []
baseline_encodings = {}  # store average encoding per student
student_class_info = {}  # store class info: name -> {dept, year, div}

print("[INFO] Training started...")

# Walk through hierarchical structure: Students/Department/Year/Division/StudentName/
for root, dirs, files in os.walk(STUDENTS_DIR):
    # Check if this is a student folder (contains images)
    if files and any(f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')) for f in files):
        # Extract class info and student name from path
        path_parts = root.replace(STUDENTS_DIR, '').strip(os.sep).split(os.sep)
        
        # Handle the new 'images' subdirectory structure
        if path_parts[-1].lower() == 'images' and len(path_parts) >= 2:
            student_name = path_parts[-2]
            path_parts = path_parts[:-1]  # Remove 'images' for dept/year/div index
        else:
            student_name = path_parts[-1]
        
        # Check if student name exists in database
        if student_name not in valid_names:
            print(f"[WARNING] '{student_name}' folder does not match any Name in database!")
            continue
        
        if len(path_parts) >= 4:
            dept_from_path = path_parts[0]
            year_from_path = path_parts[1]
            div_from_path = path_parts[2]
            print(f"[PROCESSING] {student_name} ({dept_from_path} {year_from_path} {div_from_path})...")
        else:
            print(f"[PROCESSING] {student_name}...")
        
        student_encodings = []
        
        for img_name in files:
            if not img_name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')):
                continue
                
            img_path = os.path.join(root, img_name)
            img = cv2.imread(img_path)
            if img is None:
                print(f"[SKIPPED] {img_name} (invalid image)")
                continue
            
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            boxes = face_recognition.face_locations(rgb_img)
            encodings = face_recognition.face_encodings(rgb_img, boxes)
            
            for enc in encodings:
                known_encodings.append(enc)
                known_names.append(student_name)
                student_encodings.append(enc)

        if student_encodings:
            # Compute average encoding for fuzzy baseline
            baseline_encodings[student_name] = np.mean(student_encodings, axis=0)
            
            # Store class information
            if student_name in students_info:
                student_class_info[student_name] = {
                    'department': students_info[student_name].get('department') or students_info[student_name].get('class', ''),
                    'year': students_info[student_name].get('year', ''),
                    'division': students_info[student_name].get('division', ''),
                    'roll_no': students_info[student_name].get('roll_no', '')
                }
                print(f"[INFO] Baseline encoding computed for {student_name} ({student_class_info[student_name]['department']} {student_class_info[student_name]['year']} {student_class_info[student_name]['division']})")
            else:
                print(f"[INFO] Baseline encoding computed for {student_name}")

print(f"[INFO] Training completed. Encoded {len(known_names)} faces.")

# ----------------------------
# Save Encodings + Baseline + Class Info
# ----------------------------
with open(ENCODINGS_PATH, "wb") as f:
    pickle.dump((known_encodings, known_names, baseline_encodings, student_class_info), f)

print(f"[INFO] Encodings saved to {ENCODINGS_PATH}")
print(f"[INFO] Saved class information for {len(student_class_info)} students")

# ----------------------------
# Show Summary
# ----------------------------
print("\n" + "="*60)
print("TRAINING SUMMARY")
print("="*60)
print(f"Total unique students encoded: {len(set(known_names))}")
print(f"Total face encodings: {len(known_encodings)}")
print(f"Baseline encodings: {len(baseline_encodings)}")
print(f"Students with class info: {len(student_class_info)}")

if 'old_students' in locals() and 'current_students' in locals():
    deleted = old_students - current_students
    added = current_students - old_students
    
    if deleted:
        print(f"\n🗑️  Removed encodings for: {', '.join(sorted(deleted))}")
    if added:
        print(f"✅ Added encodings for: {', '.join(sorted(added))}")
    if not deleted and not added:
        print("\n✅ All encodings are up to date (no changes)")
print("="*60)
