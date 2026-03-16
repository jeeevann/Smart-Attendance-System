import pickle
import os

ENCODINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "encodings.pkl")

try:
    with open(ENCODINGS_PATH, "rb") as f:
        data = pickle.load(f)
        if len(data) == 4:
            known_encodings, known_names, baseline_encodings, student_class_info = data
        else:
            known_encodings, known_names, baseline_encodings = data
            student_class_info = {}
    
    print(f"Total encodings: {len(known_encodings)}")
    print(f"Unique students: {len(set(known_names))}")
    print(f"\nStudents with encodings:")
    for name in sorted(set(known_names)):
        count = known_names.count(name)
        print(f"  - {name}: {count} encodings")
    
    print(f"\nBaseline encodings: {len(baseline_encodings)}")
    print(f"Class info entries: {len(student_class_info)}")
    
except Exception as e:
    print(f"Error: {e}")
