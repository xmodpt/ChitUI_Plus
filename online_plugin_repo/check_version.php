<?php
/**
 * Version Check Script
 * This file helps verify if you have the fixed version of the ChitUI Plugin Repository
 */

echo "<!DOCTYPE html><html><head><title>Version Check</title>";
echo "<style>body{font-family:Arial;padding:20px;} .good{color:green;} .bad{color:red;} .warn{color:orange;}</style>";
echo "</head><body>";
echo "<h1>ChitUI Plugin Repository - Version Check</h1>";

$allGood = true;

// Check 1: config.php exists
echo "<h2>Checking Files...</h2>";
if (file_exists('config.php')) {
    $configContent = file_get_contents('config.php');

    // Check if it has the fix (no premature die)
    if (strpos($configContent, '// Don\'t die here - let individual pages handle the error gracefully') !== false) {
        echo "<p class='good'>✓ config.php - FIXED VERSION (has proper error handling)</p>";
    } else {
        echo "<p class='bad'>✗ config.php - OLD VERSION (needs update)</p>";
        $allGood = false;
    }
} else {
    echo "<p class='bad'>✗ config.php - NOT FOUND</p>";
    $allGood = false;
}

// Check 2: index.php has database check
if (file_exists('index.php')) {
    $indexContent = file_get_contents('index.php');

    if (strpos($indexContent, 'if ($pdo === null)') !== false) {
        echo "<p class='good'>✓ index.php - FIXED VERSION (has database check)</p>";
    } else {
        echo "<p class='bad'>✗ index.php - OLD VERSION (needs update)</p>";
        $allGood = false;
    }
} else {
    echo "<p class='bad'>✗ index.php - NOT FOUND</p>";
    $allGood = false;
}

// Check 3: admin.php has database check
if (file_exists('admin.php')) {
    $adminContent = file_get_contents('admin.php');

    if (strpos($adminContent, 'if ($pdo === null)') !== false) {
        echo "<p class='good'>✓ admin.php - FIXED VERSION (has database check)</p>";
    } else {
        echo "<p class='bad'>✗ admin.php - OLD VERSION (needs update)</p>";
        $allGood = false;
    }
} else {
    echo "<p class='bad'>✗ admin.php - NOT FOUND</p>";
    $allGood = false;
}

// Check 4: schema.sql has plugin_images table
if (file_exists('schema.sql')) {
    $schemaContent = file_get_contents('schema.sql');

    if (strpos($schemaContent, 'CREATE TABLE IF NOT EXISTS plugin_images') !== false) {
        echo "<p class='good'>✓ schema.sql - UPDATED (includes plugin_images table)</p>";
    } else {
        echo "<p class='warn'>⚠ schema.sql - NEEDS UPDATE (missing plugin_images table)</p>";
    }
} else {
    echo "<p class='bad'>✗ schema.sql - NOT FOUND</p>";
}

echo "<hr>";

if ($allGood) {
    echo "<h2 class='good'>✓ All Critical Files Updated!</h2>";
    echo "<p>You have the fixed version. The errors should be resolved.</p>";
    echo "<p><a href='index.php'>Go to Home Page</a> | <a href='admin.php'>Go to Admin Panel</a></p>";
} else {
    echo "<h2 class='bad'>✗ Files Need Updating</h2>";
    echo "<p><strong>You need to update your files with the fixed versions.</strong></p>";
    echo "<h3>How to Update:</h3>";
    echo "<ol>";
    echo "<li>Download the latest files from: <br><code>https://github.com/xmodpt/ChitUI_Plus/tree/claude/fix-undefined-addPluginImage-01J7iUJGtvoAgGFXVkWPKU6K/online_plugin_repo</code></li>";
    echo "<li>Replace the files in: <code>C:\\xampp\\htdocs\\</code></li>";
    echo "<li>Refresh this page to verify</li>";
    echo "</ol>";
    echo "<p><strong>Critical files to update:</strong></p>";
    echo "<ul>";
    echo "<li>config.php</li>";
    echo "<li>index.php</li>";
    echo "<li>admin.php</li>";
    echo "<li>admin_simple.php</li>";
    echo "<li>plugin.php</li>";
    echo "<li>login.php</li>";
    echo "<li>download.php</li>";
    echo "<li>schema.sql</li>";
    echo "</ul>";
}

echo "</body></html>";
?>
