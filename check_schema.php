<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
require 'config.php';
$cols = $pdo->query('SHOW COLUMNS FROM students')->fetchAll(PDO::FETCH_COLUMN);
echo implode(', ', $cols) . "\n";
echo "Total columns: " . count($cols) . "\n";

// Check for missing required cols
$required = ['id','name','email','phone','roll_no','class','year','division','class_name','section','department','photo_folder_path','face_encoding','created_at'];
$missing = array_diff($required, $cols);
if ($missing) {
    echo "MISSING: " . implode(', ', $missing) . "\n";
    // Add them
    $defs = [
        'section'          => "ALTER TABLE students ADD COLUMN section VARCHAR(50) DEFAULT ''",
        'department'       => "ALTER TABLE students ADD COLUMN department VARCHAR(100) DEFAULT ''",
        'photo_folder_path'=> "ALTER TABLE students ADD COLUMN photo_folder_path VARCHAR(255) DEFAULT ''",
        'class_name'       => "ALTER TABLE students ADD COLUMN class_name VARCHAR(100) DEFAULT ''",
    ];
    foreach ($missing as $m) {
        if (isset($defs[$m])) {
            try { $pdo->exec($defs[$m]); echo "Added: $m\n"; } catch(Exception $e) { echo "Skip $m: ".$e->getMessage()."\n"; }
        }
    }
} else {
    echo "All required columns present!\n";
}
