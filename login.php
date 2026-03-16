<?php
require_once 'config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = isset($data['email']) ? trim(strtolower($data['email'])) : '';
$password = isset($data['password']) ? $data['password'] : '';
$role = isset($data['role']) ? $data['role'] : '';

if ($role !== 'Teacher' && $role !== 'Admin') {
    echo json_encode(['success' => false, 'error' => 'Invalid role']);
    exit;
}

try {
    if ($role === 'Teacher') {
        $stmt = $pdo->prepare("SELECT id, name, email, password, department FROM teachers WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user && $user['password'] && password_verify($password, $user['password'])) {
            echo json_encode(['success' => true, 'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => 'Teacher'
            ]]);
            exit;
        }
        echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
        exit;
    }

   
    $defaultAdminEmail = 'admin@1';
    $defaultAdminPassword = 'admin123';
    if ($email === $defaultAdminEmail && $password === $defaultAdminPassword) {
        echo json_encode(['success' => true, 'user' => [
            'id' => 0,
            'name' => 'Admin',
            'email' => $defaultAdminEmail,
            'role' => 'Admin'
        ]]);
        exit;
    }
    echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
?>


