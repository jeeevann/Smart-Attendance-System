# Smart Attendance System - Cleanup Script
# Removes unnecessary duplicate and test files

Write-Host "=" -NoNewline; Write-Host "="*60
Write-Host "  Smart Attendance System - Cleanup Script"
Write-Host "=" -NoNewline; Write-Host "="*60
Write-Host ""

$projectDir = "C:\xampp\htdocs\Mini-Project\FaceRecognition"
Set-Location $projectDir

Write-Host "Current directory: $projectDir" -ForegroundColor Cyan
Write-Host ""

# Files to delete
$filesToDelete = @(
    "flask_server.py",
    "teacher-dashboard.js",
    "testing.py",
    "test_api.html",
    "test_button.html",
    "test_login.html",
    "test_integration.py",
    "test_activities.html",
    "RollNo,Name.txt",
    "techer",
    "reload_system.py"
)

# Folders to delete
$foldersToDelete = @(
    "venv - Copy",
    "__pycache__"
)

Write-Host "Files to be deleted:" -ForegroundColor Yellow
foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "  ❌ $file ($size bytes)" -ForegroundColor Red
    } else {
        Write-Host "  ⚠️  $file (not found)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Folders to be deleted:" -ForegroundColor Yellow
foreach ($folder in $foldersToDelete) {
    if (Test-Path $folder) {
        $size = (Get-ChildItem $folder -Recurse | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "  ❌ $folder ($sizeMB MB)" -ForegroundColor Red
    } else {
        Write-Host "  ⚠️  $folder (not found)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "⚠️  WARNING: This action cannot be undone!" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Do you want to proceed with cleanup? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host ""
    Write-Host "❌ Cleanup cancelled." -ForegroundColor Red
    Write-Host ""
    exit
}

Write-Host ""
Write-Host "🗑️  Starting cleanup..." -ForegroundColor Green
Write-Host ""

$deletedFiles = 0
$deletedFolders = 0
$totalSizeFreed = 0

# Delete files
foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        try {
            $size = (Get-Item $file).Length
            Remove-Item $file -Force
            Write-Host "  ✅ Deleted: $file" -ForegroundColor Green
            $deletedFiles++
            $totalSizeFreed += $size
        } catch {
            Write-Host "  ❌ Failed to delete: $file" -ForegroundColor Red
        }
    }
}

# Delete folders
foreach ($folder in $foldersToDelete) {
    if (Test-Path $folder) {
        try {
            $size = (Get-ChildItem $folder -Recurse | Measure-Object -Property Length -Sum).Sum
            Remove-Item $folder -Recurse -Force
            Write-Host "  ✅ Deleted folder: $folder" -ForegroundColor Green
            $deletedFolders++
            $totalSizeFreed += $size
        } catch {
            Write-Host "  ❌ Failed to delete folder: $folder" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=" -NoNewline; Write-Host "="*60
Write-Host "  Cleanup Complete!" -ForegroundColor Green
Write-Host "=" -NoNewline; Write-Host "="*60
Write-Host ""
Write-Host "Summary:"
Write-Host "  Files deleted: $deletedFiles" -ForegroundColor Cyan
Write-Host "  Folders deleted: $deletedFolders" -ForegroundColor Cyan
$sizeMBFreed = [math]::Round($totalSizeFreed / 1MB, 2)
Write-Host "  Space freed: $sizeMBFreed MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Your project is now cleaner and more organized!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Test your application to ensure everything works"
Write-Host "  2. Run: python train.py (if needed)"
Write-Host "  3. Start Flask server: python face_recognition_server.py"
Write-Host ""

# Pause to show results
Read-Host "Press Enter to exit"
