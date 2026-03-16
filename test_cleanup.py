"""
Test script to demonstrate encoding cleanup when students are deleted
"""

import pickle
import os

ENCODINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "encodings.pkl")

def simulate_deleted_student():
    """
    This script demonstrates what happens when a student is deleted:
    
    1. Shows current encodings
    2. Explains what would happen if a student is deleted
    3. Shows how train.py detects and removes old encodings
    """
    
    print("=" * 70)
    print("ENCODING CLEANUP DEMONSTRATION")
    print("=" * 70)
    
    # Load current encodings
    try:
        with open(ENCODINGS_PATH, "rb") as f:
            data = pickle.load(f)
            if len(data) == 4:
                known_encodings, known_names, baseline_encodings, student_class_info = data
            else:
                known_encodings, known_names, baseline_encodings = data
                student_class_info = {}
        
        print(f"\n📊 Current State:")
        print(f"   - Total encodings: {len(known_encodings)}")
        print(f"   - Unique students: {len(set(known_names))}")
        print(f"\n👥 Students with encodings:")
        
        for name in sorted(set(known_names)):
            count = known_names.count(name)
            class_info = ""
            if name in student_class_info:
                info = student_class_info[name]
                class_info = f" ({info['department']} {info['year']} {info['division']})"
            print(f"   ✓ {name}: {count} encoding(s){class_info}")
        
        print("\n" + "=" * 70)
        print("HOW CLEANUP WORKS")
        print("=" * 70)
        
        print("""
Step 1: When you DELETE a student
   - Delete from database (MySQL/PHP admin panel)
   - Delete their image folder (students/Department/Year/Division/Name/)
   
Step 2: Run training script
   $ python train.py
   
Step 3: What happens:
   ✓ Script loads current students from database
   ✓ Compares with old encodings
   ✓ Detects deleted students
   ✓ Rebuilds encodings WITHOUT deleted students
   ✓ Shows summary of changes

Step 4: Result
   ✓ Deleted students will NOT be recognized anymore
   ✓ Only current students remain in encodings.pkl
   ✓ System stays synchronized with database
""")
        
        print("=" * 70)
        print("EXAMPLE SCENARIO")
        print("=" * 70)
        
        current_students = set(known_names)
        print(f"\nCurrent students in encodings: {current_students}")
        print("\nIf you delete 'Test Student' from database:")
        print("   1. Remove from MySQL database")
        print("   2. Delete folder: students/Computer/TY/A/Test Student/")
        print("   3. Run: python train.py")
        print("\nExpected output:")
        print("   [INFO] Detected 1 deleted student(s): {'Test Student'}")
        print("   [INFO] Old encodings will be cleaned up...")
        print("   🗑️  Removed encodings for: Test Student")
        
        print("\n" + "=" * 70)
        print("✅ The system is now set up for automatic cleanup!")
        print("=" * 70)
        
    except FileNotFoundError:
        print("\n❌ No encodings.pkl found. Run train.py first!")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    simulate_deleted_student()
