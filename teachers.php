<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Ensure teachers table exists (idempotent)
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        department VARCHAR(100) NOT NULL,
        employee_id VARCHAR(100) NULL,
        designation VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_teachers_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) { /* ignore */ }

switch($method) {
    case 'OPTIONS':
        http_response_code(200);
        exit;

    case 'GET':
       
        $stmt = $pdo->query("SELECT id, name, email, phone, department, employee_id, designation, created_at FROM teachers ORDER BY created_at DESC");
        $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($teachers);
        break;
        
    case 'POST':
      
        $data = json_decode(file_get_contents('php://input'), true);
        
        try {
            $cols = [
                'password' => "ALTER TABLE teachers ADD COLUMN password VARCHAR(255) NULL AFTER email",
                'phone' => "ALTER TABLE teachers ADD COLUMN phone VARCHAR(50) NULL AFTER password",
                'employee_id' => "ALTER TABLE teachers ADD COLUMN employee_id VARCHAR(100) NULL AFTER department",
                'designation' => "ALTER TABLE teachers ADD COLUMN designation VARCHAR(100) NULL AFTER employee_id",
                'created_at' => "ALTER TABLE teachers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ];
            foreach ($cols as $col => $sql) {
                $check = $pdo->query("SHOW COLUMNS FROM teachers LIKE " . $pdo->quote($col));
                if ($check->rowCount() === 0) {
                    $pdo->exec($sql);
                }
            }

            $idx = $pdo->query("SHOW INDEX FROM teachers WHERE Key_name = 'uniq_teachers_email'");
            if ($idx->rowCount() === 0) {
                $pdo->exec("ALTER TABLE teachers ADD CONSTRAINT uniq_teachers_email UNIQUE (email)");
            }
        } catch (Exception $e) { /* ignore */ }
        $passwordHash = isset($data['password']) && $data['password'] !== '' ? password_hash($data['password'], PASSWORD_BCRYPT) : null;
        $phoneOrNull = (isset($data['phone']) && trim($data['phone']) !== '') ? $data['phone'] : null;
        
        try {
            $stmt = $pdo->prepare("INSERT INTO teachers (name, email, password, phone, department, employee_id, designation) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $result = $stmt->execute([
                $data['name'],
                $data['email'],
                $passwordHash,
                $phoneOrNull,
                $data['department'],
                $data['employee_id'] ?? '',
                $data['designation'] ?? ''
            ]);
            if($result) {
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Failed to add teacher']);
            }
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') { // integrity constraint violation
                http_response_code(409);
                $msg = 'Duplicate value';
                $em = strtolower($e->getMessage());
                if (strpos($em, 'uniq_teachers_email') !== false || strpos($em, 'email') !== false) { $msg = 'Email already exists'; }
                echo json_encode(['success' => false, 'error' => $msg]);
            } else {
                http_response_code(500);
                $debug = getenv('APP_DEBUG');
                echo json_encode(['success' => false, 'error' => $debug ? $e->getMessage() : 'Server error']);
            }
        }
        break;
        
    case 'PUT':
        // Update teacher
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'];
        $passwordClause = '';
        $params = [
            $data['name'],
            $data['email'],
            (isset($data['phone']) && trim($data['phone']) !== '') ? $data['phone'] : null,
            $data['department'],
            $data['employee_id'] ?? '',
            $data['designation'] ?? ''
        ];
        if (isset($data['password']) && $data['password'] !== '') {
            $passwordClause = ', password=?';
            $params[] = password_hash($data['password'], PASSWORD_BCRYPT);
        }
        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE teachers SET name=?, email=?, phone=?, department=?, employee_id=?, designation=?$passwordClause WHERE id=?");
        try {
            $result = $stmt->execute($params);
            echo json_encode(['success' => $result]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                http_response_code(409);
                $msg = 'Duplicate value';
                $em = strtolower($e->getMessage());
                if (strpos($em, 'uniq_teachers_email') !== false || strpos($em, 'email') !== false) { $msg = 'Email already exists'; }
                echo json_encode(['success' => false, 'error' => $msg]);
            } else {
                http_response_code(500);
                $debug = getenv('APP_DEBUG');
                echo json_encode(['success' => false, 'error' => $debug ? $e->getMessage() : 'Server error']);
            }
        }
        break;
        
    case 'DELETE':
        // Delete teacher
        $id = $_GET['id'];
        $stmt = $pdo->prepare("DELETE FROM teachers WHERE id = ?");
        $result = $stmt->execute([$id]);
        echo json_encode(['success' => $result]);
        break;
}
?>
