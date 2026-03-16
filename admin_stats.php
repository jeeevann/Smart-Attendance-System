<?php
require_once 'config.php';
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

try {
    // Ensure tables exist before counting (idempotent safeguards)
    $pdo->exec("CREATE TABLE IF NOT EXISTS teachers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE, password VARCHAR(255) NULL, phone VARCHAR(50) DEFAULT '', department VARCHAR(100) NOT NULL, employee_id VARCHAR(100) DEFAULT '', designation VARCHAR(100) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS students (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, class VARCHAR(50) DEFAULT '', year VARCHAR(10) DEFAULT '', division VARCHAR(10) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS lectures_schedule (id INT AUTO_INCREMENT PRIMARY KEY, teacher_id INT, class VARCHAR(50), year VARCHAR(10), division VARCHAR(10), subject VARCHAR(100), day_of_week TINYINT, start_time TIME, end_time TIME, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");

    $teachers = (int)$pdo->query("SELECT COUNT(*) FROM teachers")->fetchColumn();
    $students = (int)$pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();
    $classes = (int)$pdo->query("SELECT COUNT(DISTINCT CONCAT(class,'-',year,'-',division)) FROM students WHERE class<>'' AND year<>'' AND division<>''")->fetchColumn();

    echo json_encode([ 'success' => true, 'teachers' => $teachers, 'students' => $students, 'classes' => $classes ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([ 'success' => false ]);
}
?>


