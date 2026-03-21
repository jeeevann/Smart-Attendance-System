<?php
// Prefer explicit DB_* vars, then common managed-DB variable names.
function firstEnv(array $keys, $default = '') {
    foreach ($keys as $key) {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }
    }
    return $default;
}

// Database configuration (supports both split vars and URL-based config)
$host = firstEnv(['DB_HOST', 'MYSQLHOST'], 'localhost');
$dbname = firstEnv(['DB_NAME', 'MYSQLDATABASE'], 'smart_attendance');
$username = firstEnv(['DB_USER', 'DB_USERNAME', 'MYSQLUSER'], 'root');
$password = firstEnv(['DB_PASS', 'DB_PASSWORD', 'MYSQLPASSWORD'], '');
$port = firstEnv(['DB_PORT', 'MYSQLPORT'], '');
$sslMode = firstEnv(['DB_SSLMODE', 'MYSQL_SSL_MODE'], '');
$sslCaPem = firstEnv(['DB_SSL_CA_PEM', 'MYSQL_SSL_CA_PEM'], '');
$dbUrl = firstEnv(['DATABASE_URL', 'MYSQL_URL', 'JAWSDB_URL'], '');

if ($dbUrl) {
    $parsed = parse_url($dbUrl);
    if ($parsed !== false) {
        // Accept mysql://user:pass@host:port/dbname style URLs.
        if (!empty($parsed['host'])) {
            $host = $parsed['host'];
        }
        if (!empty($parsed['port'])) {
            $port = (string)$parsed['port'];
        }
        if (!empty($parsed['user'])) {
            $username = $parsed['user'];
        }
        if (array_key_exists('pass', $parsed) && $parsed['pass'] !== null) {
            $password = $parsed['pass'];
        }
        if (!empty($parsed['path'])) {
            $pathDb = ltrim($parsed['path'], '/');
            if ($pathDb !== '') {
                $dbname = $pathDb;
            }
        }
    }
}

$appDebug = strtolower((string)firstEnv(['APP_DEBUG'], 'false'));
$appDebugEnabled = in_array($appDebug, ['1', 'true', 'yes', 'on'], true);

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
          image_data MEDIUMTEXT NULL,
          photo_folder_path VARCHAR(255) NULL,
          face_encoding MEDIUMTEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_roll_no (roll_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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
          KEY idx_attendance_student_id (student_id),
          KEY idx_attendance_teacher_id (teacher_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch(PDOException $e) {
    http_response_code(500);
    if ($appDebugEnabled) {
        echo json_encode([
            'success' => false,
            'error' => 'DB connection failed',
            'details' => $e->getMessage(),
            'host' => $host,
            'port' => $port,
            'database' => $dbname,
            'user' => $username,
        ]);
    } else {
        echo json_encode([ 'success' => false, 'error' => 'DB connection failed' ]);
    }
    exit;
}
?>
