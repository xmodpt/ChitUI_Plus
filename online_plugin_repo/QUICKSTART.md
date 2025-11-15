# Quick Start Guide - ChitUI Plugin Repository

## Prerequisites

- PHP 7.4 or higher
- MySQL 5.7 or higher (or MariaDB 10.2+)
- Apache or Nginx web server
- mod_rewrite enabled (for Apache)

## Installation Steps

### 1. Copy Files

Copy the `online_plugin_repo` folder to your web server directory:

**For XAMPP (Windows):**
```
C:\xampp\htdocs\chitui_plugins\
```

**For Apache (Linux):**
```
/var/www/html/chitui_plugins/
```

### 2. Configure Database

Edit `config.php` and update these settings:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'chitui_plugins');
define('DB_USER', 'your_mysql_username');  // Change this
define('DB_PASS', 'your_mysql_password');  // Change this
```

### 3. Create Database

**Option A: Using phpMyAdmin**
1. Open phpMyAdmin
2. Click "Import"
3. Select `schema.sql` file
4. Click "Go"

**Option B: Using MySQL command line**
```bash
mysql -u root -p < schema.sql
```

**Option C: Manual creation**
```bash
mysql -u root -p
> CREATE DATABASE chitui_plugins CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> USE chitui_plugins;
> source /path/to/schema.sql;
> exit;
```

### 4. Set Up Upload Directories

Make sure the upload directories exist and are writable:

```bash
chmod 755 uploads/
chmod 755 uploads/plugins/
chmod 755 uploads/images/
```

On Windows (XAMPP), ensure the IIS_IUSRS or NETWORK SERVICE has write permissions to the uploads folder.

### 5. Test Installation

1. Open your browser and navigate to:
   - `http://localhost/chitui_plugins/diagnostic.php`

2. This will check:
   - Database connection
   - Required tables
   - Upload directory permissions
   - PHP version

### 6. Login to Admin Panel

1. Navigate to: `http://localhost/chitui_plugins/admin.php`
2. Default credentials:
   - Username: `admin`
   - Password: `admin123`

⚠️ **IMPORTANT:** Change the default password immediately after first login!

## Troubleshooting

### Error: "Call to undefined function addPluginImage()"

**Cause:** Database connection failed before function definitions were loaded.

**Solution:**
1. Check that MySQL/MariaDB is running
2. Verify database credentials in `config.php`
3. Make sure database `chitui_plugins` exists
4. Run `schema.sql` to create required tables
5. Run `diagnostic.php` to identify the exact issue

### Error: "Database connection failed"

1. Check MySQL is running:
   - Windows (XAMPP): Start MySQL in XAMPP Control Panel
   - Linux: `sudo systemctl status mysql`

2. Verify credentials in `config.php`

3. Test connection manually:
```bash
mysql -h localhost -u your_username -p
```

### Error: "Table 'plugin_images' doesn't exist"

Run the updated `schema.sql` file which now includes the `plugin_images` table.

### Upload errors

1. Check directory permissions:
```bash
ls -la uploads/
```

2. On Linux, set proper ownership:
```bash
sudo chown -R www-data:www-data uploads/
```

3. On Windows (XAMPP), right-click `uploads` folder → Properties → Security → Edit → Add write permissions

## Security Recommendations

1. **Change default admin password immediately**
2. **Update database credentials** from defaults
3. **Restrict admin.php access** using .htaccess or server configuration
4. **Enable HTTPS** in production
5. **Keep PHP and MySQL updated**

## Next Steps

- Add your first plugin via the admin panel
- Customize the site name and URL in `config.php`
- Review `FEATURES.md` for advanced features
- Check `README.md` for complete documentation

## Getting Help

If you encounter issues:
1. Run `diagnostic.php` first
2. Check Apache/Nginx error logs
3. Enable PHP error reporting in development
4. Review `INSTALL.txt` for detailed instructions
