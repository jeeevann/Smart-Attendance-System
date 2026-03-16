<?php
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

    // Ensure required tables exist
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS teachers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          department VARCHAR(100) NOT NULL
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS students (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          roll_no VARCHAR(20) NOT NULL,
          department VARCHAR(100) NOT NULL,
          year VARCHAR(20) NOT NULL,
          division VARCHAR(10) NOT NULL
        )
    ");

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
          FOREIGN KEY (student_id) REFERENCES students(id),
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        )
    ");
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode([ 'success' => false, 'error' => 'DB connection failed' ]);
    exit;
}
?>
