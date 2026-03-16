<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    case 'GET':
        // Get attendance records
        $dept = $_GET['department'] ?? '';
        $year = $_GET['year'] ?? '';
        $division = $_GET['division'] ?? '';
        $date = $_GET['date'] ?? date('Y-m-d');
        
        $sql = "SELECT a.*, s.name as student_name, s.roll_no, t.name as teacher_name 
                FROM attendance a 
                LEFT JOIN students s ON a.student_id = s.id 
                LEFT JOIN teachers t ON a.teacher_id = t.id 
                WHERE 1=1";
        $params = [];
        
        if($dept) {
            $sql .= " AND a.department = ?";
            $params[] = $dept;
        }
        if($year) {
            $sql .= " AND a.year = ?";
            $params[] = $year;
        }
        if($division) {
            $sql .= " AND a.division = ?";
            $params[] = $division;
        }
        if($date) {
            $sql .= " AND a.attendance_date = ?";
            $params[] = $date;
        }
        
        $sql .= " ORDER BY a.marked_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($records);
        break;
        
    case 'POST':
        // Mark attendance
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $pdo->prepare("INSERT INTO attendance (student_id, teacher_id, department, year, division, time_slot, attendance_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $result = $stmt->execute([
            $data['student_id'] ?? null,
            $data['teacher_id'] ?? null,
            $data['department'],
            $data['year'],
            $data['division'],
            $data['time_slot'],
            $data['attendance_date'] ?? date('Y-m-d')
        ]);
        
        if($result) {
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to mark attendance']);
        }
        break;
}
?>
