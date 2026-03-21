import cv2
import face_recognition
import pickle
import pandas as pd
from datetime import datetime
import os
import numpy as np
import base64

class FaceRecognitionSystem:
    def __init__(self):
        # ----------------------------
        # Paths
        # ----------------------------
        self.BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        self.ENCODINGS_PATH = os.path.join(self.BASE_DIR, "encodings.pkl")
        self.STUDENTS_CSV = os.path.join(self.BASE_DIR, "students.csv")
        self.ATTENDANCE_DIR = os.path.join(self.BASE_DIR, "AttendanceFiles")
        
        # Create attendance folder if it doesn't exist
        if not os.path.exists(self.ATTENDANCE_DIR):
            os.makedirs(self.ATTENDANCE_DIR)
        
        # Load encodings and students data
        self.load_data()
        
        # Prepare today's attendance file
        self.setup_attendance_file()
    
    def load_data(self):
        """Load face encodings and student data DIRECTLY from Aiven MySQL (Cloud)"""
        import mysql.connector as mysql
        
        # Load env variables
        env_path = os.path.join(self.BASE_DIR, ".env")
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

        try:
            db = mysql.connect(host=host, port=port, user=user, password=password, database=database)
            cursor = db.cursor(dictionary=True)
            
            # Fetch all students from DB
            cursor.execute("SELECT id, name, roll_no, department, class as class_name, year, division, face_encoding FROM students")
            students_data = cursor.fetchall()
            
            self.baseline_encodings = {}
            self.student_class_info = {}
            self.known_names = []
            
            students_list_for_df = []
            
            for s in students_data:
                # Store student info for records
                roll_str = str(s['roll_no']).strip() if s['roll_no'] else ''
                name = str(s['name']).strip()
                
                students_list_for_df.append({
                    "Name": name,
                    "RollNo": roll_str
                })
                
                # Setup class info
                dept = s['department'] if s['department'] else s['class_name']
                self.student_class_info[name] = {
                    'department': dept or '',
                    'year': s['year'] or '',
                    'division': s['division'] or '',
                    'roll_no': roll_str
                }
                
                # Setup encoding if present
                if s.get('face_encoding'):
                    enc_b64 = s['face_encoding']
                    try:
                        enc_bytes = base64.b64decode(enc_b64)
                        enc_array = pickle.loads(enc_bytes)
                        self.baseline_encodings[name] = enc_array
                        self.known_names.append(name)
                    except Exception as e:
                        print(f"[WARNING] Failed to decode face_encoding for {name}: {e}")
            
            # Create the DataFrame equivalent from DB data
            self.students_df = pd.DataFrame(students_list_for_df)
            
            cursor.close()
            db.close()
            
            print(f"[INFO] Loaded {len(self.known_names)} face encodings from Cloud DB")
            print(f"[INFO] Loaded {len(self.students_df)} student records from Cloud DB")
        except Exception as e:
            print(f"[ERROR] Failed to load data from Cloud DB: {e}")
            raise
    
    def setup_attendance_file(self, department=None, year=None, division=None, time_slot=None):
        """Setup attendance file based on class and time slot"""
        today_date = datetime.now().strftime("%Y-%m-%d")
        
        # If class info provided, create structured folder and filename
        if department and year and division and time_slot:
            # Create full folder hierarchy: department/year/division
            class_folder = os.path.join(self.ATTENDANCE_DIR, department, year, division)
            if not os.path.exists(class_folder):
                os.makedirs(class_folder)
                print(f"[INFO] Created class folder: {class_folder}")
            
            # Sanitize time slot for filename (replace spaces and colons with dashes)
            safe_time = time_slot.replace(" ", "").replace(":", "-").replace("--", "-")
            filename = f"{today_date}_{safe_time}.csv"
            self.attendance_file = os.path.join(class_folder, filename)
            
            # Store class metadata for reference
            self.current_class = {
                'department': department,
                'year': year,
                'division': division,
                'time_slot': time_slot
            }
        else:
            # Fallback to old format
            filename = f"attendance_{today_date}.csv"
            self.attendance_file = os.path.join(self.ATTENDANCE_DIR, filename)
            self.current_class = None
        
        if not os.path.exists(self.attendance_file):
            with open(self.attendance_file, "w", newline="") as f:
                # Add class info in the header for reference
                if self.current_class:
                    f.write(f"# Department: {department}, Year: {year}, Division: {division}, Time Slot: {time_slot}\n")
                f.write("RollNo,Name,Time,Confidence,Status\n")
        
        print(f"[INFO] Attendance file: {self.attendance_file}")
        
        # Load already marked students from this specific file
        try:
            existing_df = pd.read_csv(self.attendance_file, comment='#')
            self.marked_students = set(existing_df["RollNo"].astype(str).str.strip())
            print(f"[INFO] Already marked: {len(self.marked_students)} students")
        except:
            self.marked_students = set()
    
    def filter_encodings_by_class(self, department, year, division):
        """Filter baseline encodings to only include students from the selected class"""
        if not self.student_class_info:
            print("[WARNING] No class information available. Using all encodings.")
            return self.baseline_encodings
        
        filtered_encodings = {}
        for student_name, encoding in self.baseline_encodings.items():
            if student_name in self.student_class_info:
                info = self.student_class_info[student_name]
                # Match department, year, and division
                if (info['department'] == department and 
                    info['year'] == year and 
                    info['division'] == division):
                    filtered_encodings[student_name] = encoding
        
        print(f"[INFO] Filtered to {len(filtered_encodings)} students from {department} {year} {division}")
        return filtered_encodings
    
    def decode_base64_image(self, image_data):
        """Decode base64 image data to OpenCV format"""
        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return frame
        except Exception as e:
            print(f"[ERROR] Failed to decode image: {e}")
            return None
    
    def recognize_face_from_image(self, image_data, department=None, year=None, division=None, time_slot=None):
        """Recognize face from base64 image data with optional class filtering"""
        # Setup attendance file for this specific class and time slot
        if department and year and division and time_slot:
            self.setup_attendance_file(department, year, division, time_slot)
        frame = self.decode_base64_image(image_data)
        if frame is None:
            return {"success": False, "error": "Invalid image data"}
        
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
            
            if not face_encodings:
                return {"success": False, "error": "No face detected"}
            
            face_encoding = face_encodings[0]
            best_confidence = 0
            best_name = "Unknown"
            wrong_class_detected = False
            wrong_class_info = ""
            
            # Filter encodings by class if specified
            if department and year and division:
                encodings_to_check = self.filter_encodings_by_class(department, year, division)
            else:
                encodings_to_check = self.baseline_encodings
            
            # Compare to filtered baseline encodings
            for student_name, baseline_enc in encodings_to_check.items():
                dist = np.linalg.norm(face_encoding - baseline_enc)
                confidence = round((1 - dist) * 100, 2)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_name = student_name
            
            # Apply fuzzy logic thresholds (≥ 60 accepted)
            if best_confidence >= 60:
                status = "Accepted"
                decision = "present"
            elif 40 <= best_confidence < 60:
                status = "Uncertain"
                decision = "uncertain"
            else:
                status = "Rejected"
                decision = "absent"
                best_name = "Unknown"
            
            roll_no = ""
            attendance_marked = False
            
            # Debug info
            print(f"[DEBUG] Name: {best_name}, Confidence: {best_confidence}, Status: {status}")
            
            if best_name != "Unknown":
                row = self.students_df[self.students_df["Name"].str.lower() == best_name.lower()]
                if not row.empty:
                    roll_no = str(row["RollNo"].values[0]).strip()
                    
                    if roll_no not in self.marked_students and status == "Accepted":
                        time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        try:
                            with open(self.attendance_file, "a", newline="") as f:
                                f.write(f"{roll_no},{best_name},{time_now},{best_confidence}%,{status}\n")
                                f.flush()
                            print(f"[WRITE OK] Data written to: {os.path.abspath(self.attendance_file)}")
                        except Exception as e:
                            print(f"[ERROR] Could not write to file: {e}")
                        
                        self.marked_students.add(roll_no)
                        attendance_marked = True
                        print(f"[MARKED] {roll_no} - {best_name} ({best_confidence}% - {status})")
            
            return {
                "success": True,
                "name": best_name,
                "roll_no": roll_no,
                "confidence": best_confidence,
                "status": status,
                "decision": decision,
                "attendance_marked": attendance_marked,
                "already_marked": roll_no in self.marked_students if roll_no else False
            }
            
        except Exception as e:
            print(f"[ERROR] Recognition failed: {e}")
            return {"success": False, "error": str(e)}

# -----------------------
# LIVE CAMERA SECTION
# -----------------------
def main():
    system = FaceRecognitionSystem()
    
    cap = cv2.VideoCapture(0)
    print("[INFO] Starting face recognition... Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        for face_encoding, face_loc in zip(face_encodings, face_locations):
            best_confidence = 0
            best_name = "Unknown"
            
            for student_name, baseline_enc in system.baseline_encodings.items():
                dist = np.linalg.norm(face_encoding - baseline_enc)
                confidence = round((1 - dist) * 100, 2)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_name = student_name
            
            # Fuzzy thresholds (≥60 accepted)
            if best_confidence >= 60:
                status = "Accepted"
            elif 40 <= best_confidence < 60:
                status = "Uncertain"
            else:
                status = "Rejected"
                best_name = "Unknown"
            
            roll_no = ""
            if best_name != "Unknown":
                row = system.students_df[system.students_df["Name"].str.lower() == best_name.lower()]
                if not row.empty:
                    roll_no = str(row["RollNo"].values[0]).strip()
                    
                    if roll_no not in system.marked_students and status == "Accepted":
                        time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        try:
                            with open(system.attendance_file, "a", newline="") as f:
                                f.write(f"{roll_no},{best_name},{time_now},{best_confidence}%,{status}\n")
                                f.flush()
                            print(f"[WRITE OK] Data written to: {os.path.abspath(system.attendance_file)}")
                        except Exception as e:
                            print(f"[ERROR] Could not write to file: {e}")
                        
                        system.marked_students.add(roll_no)
                        print(f"[MARKED] {roll_no} - {best_name} ({best_confidence}% - {status})")
            
            top, right, bottom, left = face_loc
            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
            cv2.putText(frame, f"{best_name} ({best_confidence}%)", (left, top - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow("Face Recognition Attendance", frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Attendance marking stopped.")

if __name__ == "__main__":
    main()
