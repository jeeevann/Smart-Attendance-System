<?php
// Load .env file if it exists (for local development)
$envFile = __DIR__ . DIRECTORY_SEPARATOR . '.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line, 2);
            $key = trim($key);
            $val = trim($val, " \t\n\r\0\x0B\"'");
            putenv("$key=$val");
        }
    }
}

// Database configuration
$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'smart_attendance';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') ?: '';
$port = getenv('DB_PORT') ?: '';
$sslMode = getenv('DB_SSLMODE') ?: '';
$sslCaPem = getenv('DB_SSL_CA_PEM') ?: '';

// Enable CORS for frontend
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

try {
    $dsn = "mysql:host=$host;" . ($port ? "port=$port;" : "") . "dbname=$dbname;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ];
    // Some cloud MySQL providers (like Aiven) require TLS.
    // If DB_SSL_CA_PEM is provided, we write it to a temp file and pass it to PDO.
    if ($sslCaPem) {
        $caPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'db-ca.pem';
        file_put_contents($caPath, str_replace("\\n", "\n", $sslCaPem));
        $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    } elseif ($sslMode) {
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = ($sslMode === 'verify');
    }
    $pdo = new PDO($dsn, $username, $password, $options);

    // Ensure required tables exist (keep schema aligned with API endpoints)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS teachers (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS students (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          phone VARCHAR(50) NULL,
          roll_no VARCHAR(50) NULL,
          class VARCHAR(50) NULL,
          year VARCHAR(10) NULL,
          division VARCHAR(10) NULL,
          class_name VARCHAR(100) NULL,
          section VARCHAR(50) NULL,
          department VARCHAR(100) NULL,
          photo_folder_path VARCHAR(255) NULL,
          face_encoding MEDIUMTEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_roll_no (roll_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    
    // Ensure email column exists (fixes existing databases without it)
    try { $pdo->exec("ALTER TABLE students ADD COLUMN email VARCHAR(255) NULL"); } catch(Exception $e) { /* already exists */ }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NULL,
          teacher_id INT NULL,
          department VARCHAR(100) NOT NULL,
          year VARCHAR(20) NOT NULL,
          division VARCHAR(10) NOT NULL,
          time_slot VARCHAR(50) NOT NULL,
          attendance_date DATE NOT NULL,
          marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_attendance_student_id (student_id),
          KEY idx_attendance_teacher_id (teacher_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode([ 'success' => false, 'error' => 'DB connection failed', 'details' => $e->getMessage() ]);
    exit;
}
?>
