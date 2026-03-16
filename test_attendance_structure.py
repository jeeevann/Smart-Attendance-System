"""
Test script to verify the new attendance folder structure
Structure: AttendanceFiles/Department/Year/Division/date_timeslot.csv
"""

import os
from datetime import datetime

# Test the folder structure
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ATTENDANCE_DIR = os.path.join(BASE_DIR, "AttendanceFiles")

def test_folder_structure():
    """Test creating folders with the new structure"""
    
    # Test case 1: Computer/TY/A
    department = "Computer"
    year = "TY"
    division = "A"
    time_slot = "09:00-10:00"
    
    today_date = datetime.now().strftime("%Y-%m-%d")
    safe_time = time_slot.replace(" ", "").replace(":", "-").replace("--", "-")
    
    # Create full folder hierarchy
    class_folder = os.path.join(ATTENDANCE_DIR, department, year, division)
    os.makedirs(class_folder, exist_ok=True)
    
    # Create filename
    filename = f"{today_date}_{safe_time}.csv"
    attendance_file = os.path.join(class_folder, filename)
    
    print(f"✓ Folder structure: {class_folder}")
    print(f"✓ File path: {attendance_file}")
    print(f"✓ Relative path from AttendanceFiles: {department}/{year}/{division}/{filename}")
    
    # Test case 2: Multiple departments
    test_cases = [
        ("Computer", "TY", "A", "09:00-10:00"),
        ("Computer", "TY", "B", "10:00-11:00"),
        ("Civil", "FY", "A", "09:00-10:00"),
        ("Mechanical", "SY", "C", "11:00-12:00"),
        ("Computer", "BE", "A", "14:00-15:00"),
    ]
    
    print("\n" + "="*60)
    print("Testing multiple class structures:")
    print("="*60)
    
    for dept, yr, div, slot in test_cases:
        class_folder = os.path.join(ATTENDANCE_DIR, dept, yr, div)
        os.makedirs(class_folder, exist_ok=True)
        
        safe_time = slot.replace(" ", "").replace(":", "-").replace("--", "-")
        filename = f"{today_date}_{safe_time}.csv"
        attendance_file = os.path.join(class_folder, filename)
        
        # Create a sample CSV file
        if not os.path.exists(attendance_file):
            with open(attendance_file, "w") as f:
                f.write(f"# Department: {dept}, Year: {yr}, Division: {div}, Time Slot: {slot}\n")
                f.write("RollNo,Name,Time,Confidence,Status\n")
                f.write(f"001,Test Student,{datetime.now().strftime('%Y-%m-%d %H:%M:%S')},95.5%,Accepted\n")
        
        print(f"✓ Created: {dept}/{yr}/{div}/{filename}")
    
    print("\n" + "="*60)
    print("Folder structure created successfully!")
    print("="*60)
    
    # Show the directory tree
    print("\nDirectory tree:")
    for root, dirs, files in os.walk(ATTENDANCE_DIR):
        level = root.replace(ATTENDANCE_DIR, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        subindent = ' ' * 2 * (level + 1)
        for file in files:
            print(f'{subindent}{file}')

if __name__ == "__main__":
    test_folder_structure()
