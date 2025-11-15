<?php
/**
 * Password Hash Generator
 * Use this to generate a password hash for the admin account
 */

// Generate hash for "admin123"
$password = 'admin123';
$hash = password_hash($password, PASSWORD_DEFAULT);

echo "Password: $password\n";
echo "Hash: $hash\n\n";

echo "SQL to update admin password:\n";
echo "UPDATE admin_users SET password_hash = '$hash' WHERE username = 'admin';\n";
?>
