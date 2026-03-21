<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
require 'config.php';
echo "Connected!\n";
$stmt = $pdo->query("SHOW COLUMNS FROM students");
$cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
echo "Columns: " . implode(', ', $cols) . "\n";
