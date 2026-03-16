<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
require 'config.php';
$stmt = $pdo->query("SHOW COLUMNS FROM students");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
