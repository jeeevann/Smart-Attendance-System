<?php
// Database configuration
$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'smart_attendance';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') ?: '';
$port = getenv('DB_PORT') ?: '';
$sslMode = getenv('DB_SSLMODE') ?: '';

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
    // Some cloud MySQL providers require TLS; allow enabling it via env var.
    if ($sslMode) {
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = ($sslMode === 'verify');
    }
    $pdo = new PDO($dsn, $username, $password, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode([ 'success' => false, 'error' => 'DB connection failed' ]);
    exit;
}
?>
