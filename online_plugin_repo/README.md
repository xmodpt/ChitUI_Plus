# ChitUI Plugin Repository

A PHP/MySQL-based online plugin repository for ChitUI. Users can browse, search, and download plugins with detailed information including descriptions, images, and metadata.

## Features

- **Browse Plugins** - View all available plugins with images and descriptions
- **Search** - Find plugins by name, author, or description
- **Plugin Details** - View detailed information including:
  - Plugin info (version, author, dates)
  - Full description
  - Screenshots/images
  - Dependencies
  - Download count
  - Installation instructions
- **Download Tracking** - Automatically tracks download counts and logs
- **Admin Panel** - Manage plugins with an easy-to-use interface
- **Responsive Design** - Works on desktop and mobile devices

## Requirements

### Server Requirements

- **PHP 7.4+** (PHP 8.0+ recommended)
- **MySQL 5.7+** or **MariaDB 10.2+**
- **Apache** or **Nginx** web server
- **mod_rewrite** enabled (for Apache)

### PHP Extensions

- PDO
- PDO_MySQL
- GD (for image handling)
- FileInfo

## Installation

### 1. Upload Files

Upload all files to your web server (e.g., `/var/www/html/chitui_plugins/` or public_html).

```bash
# Example using SCP
scp -r online_plugin_repo/* user@yourserver.com:/var/www/html/chitui_plugins/

# Or using FTP client (FileZilla, etc.)
```

### 2. Set Permissions

Ensure the uploads directory is writable:

```bash
cd /var/www/html/chitui_plugins
chmod -R 755 uploads/
chown -R www-data:www-data uploads/  # For Apache
# OR
chown -R nginx:nginx uploads/  # For Nginx
```

### 3. Create Database

Import the database schema:

```bash
mysql -u root -p < schema.sql
```

Or manually create the database:

```sql
CREATE DATABASE chitui_plugins CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then import the schema:

```bash
mysql -u root -p chitui_plugins < schema.sql
```

### 4. Configure Database Connection

Edit `config.php` and update the database credentials:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'chitui_plugins');
define('DB_USER', 'your_mysql_username');
define('DB_PASS', 'your_mysql_password');
```

Also update the site URL:

```php
define('SITE_URL', 'http://yourserver.com/chitui_plugins');
```

### 5. Test Installation

Visit your site in a web browser:

```
http://yourserver.com/chitui_plugins/
```

You should see the plugin repository homepage.

## Admin Panel

### Default Login Credentials

- **Username:** `admin`
- **Password:** `admin123`

**IMPORTANT:** Change the default password immediately after first login!

### Accessing Admin Panel

1. Go to `http://yourserver.com/chitui_plugins/login.php`
2. Login with credentials
3. Access admin panel at `http://yourserver.com/chitui_plugins/admin.php`

### Adding Plugins

1. Login to admin panel
2. Fill in the "Add New Plugin" form:
   - **Required fields:**
     - Plugin Name
     - Version
     - Author
     - Short Description
   - **Optional fields:**
     - Long Description
     - UI Type (toolbar, card, modal)
     - UI Location (top, main, sidebar)
     - Icon (Bootstrap icon name)
     - Dependencies (comma-separated)
     - Plugin File (ZIP)
     - Plugin Image
3. Click "Add Plugin"

### Managing Plugins

From the admin panel you can:

- View all plugins
- See download statistics
- Delete plugins (files are also removed)
- View plugin details

## File Structure

```
online_plugin_repo/
├── config.php              # Configuration file
├── index.php               # Plugin listing page
├── plugin.php              # Plugin details page
├── download.php            # Download handler
├── login.php               # Admin login page
├── logout.php              # Logout handler
├── admin.php               # Admin panel
├── schema.sql              # Database schema
├── README.md               # This file
├── css/
│   └── style.css          # Custom styles
├── js/
│   └── (future scripts)
└── uploads/
    ├── plugins/           # Plugin ZIP files
    └── images/            # Plugin images
```

## Database Schema

### Tables

1. **plugins** - Stores plugin information
   - id, name, version, author, description, long_description
   - dependencies, ui_type, ui_location, icon
   - image_filename, plugin_filename, file_size
   - downloads, created_at, updated_at, is_active

2. **admin_users** - Admin authentication
   - id, username, password_hash, email
   - created_at, last_login, is_active

3. **download_logs** - Download tracking
   - id, plugin_id, ip_address, user_agent, downloaded_at

## Configuration Options

Edit `config.php` to customize:

### File Upload Limits

```php
define('MAX_PLUGIN_SIZE', 50 * 1024 * 1024); // 50MB
define('MAX_IMAGE_SIZE', 5 * 1024 * 1024);   // 5MB
```

### Allowed File Types

```php
define('ALLOWED_PLUGIN_TYPES', ['zip']);
define('ALLOWED_IMAGE_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
```

### Pagination

```php
define('PLUGINS_PER_PAGE', 12);  // Plugins per page
```

## Security

### Change Admin Password

To change the admin password, run this SQL:

```sql
UPDATE admin_users
SET password_hash = '$2y$10$YourNewHashHere'
WHERE username = 'admin';
```

To generate a new password hash in PHP:

```php
<?php
echo password_hash('your_new_password', PASSWORD_DEFAULT);
?>
```

### Recommendations

1. **Use HTTPS** - Install SSL certificate
2. **Strong Passwords** - Use complex admin passwords
3. **File Permissions** - Restrict write access
4. **Regular Updates** - Keep PHP and MySQL updated
5. **Backup Database** - Regular backups
6. **Limit Upload Sizes** - Prevent abuse

## Troubleshooting

### Database Connection Failed

- Check database credentials in `config.php`
- Verify MySQL service is running
- Check database exists and user has permissions

### File Upload Errors

**"Failed to upload plugin file"**
- Check `uploads/` directory permissions (755 or 775)
- Verify ownership (www-data or nginx)
- Check PHP upload limits in `php.ini`:
  ```ini
  upload_max_filesize = 50M
  post_max_size = 50M
  ```

### Images Not Displaying

- Check file exists in `uploads/images/`
- Verify correct permissions
- Check browser console for errors
- Verify image path in database

### Login Issues

- Clear browser cookies/cache
- Check session settings in `php.ini`
- Verify admin user exists in database:
  ```sql
  SELECT * FROM admin_users WHERE username = 'admin';
  ```

## API Endpoints

The repository provides several endpoints:

### Public Endpoints

- `GET /index.php` - List plugins
- `GET /index.php?search=term` - Search plugins
- `GET /plugin.php?id=X` - View plugin details
- `GET /download.php?id=X` - Download plugin

### Admin Endpoints (Authentication Required)

- `GET /admin.php` - Admin panel
- `POST /admin.php` - Add/delete plugins

## Plugin Package Format

Plugins should be packaged as ZIP files with this structure:

```
plugin_name.zip
└── plugin_name/
    ├── __init__.py
    ├── plugin.json
    ├── README.md
    ├── templates/
    │   └── template.html
    └── static/
        ├── css/
        └── js/
```

## Customization

### Changing Theme Colors

Edit `css/style.css` to customize colors and styles.

### Adding Custom Pages

Create new PHP files and include `config.php` for database access.

### Custom Fields

To add custom fields to plugins:

1. Add column to database:
   ```sql
   ALTER TABLE plugins ADD COLUMN custom_field VARCHAR(255);
   ```

2. Update forms in `admin.php`
3. Display in `plugin.php`

## Backup

### Database Backup

```bash
mysqldump -u root -p chitui_plugins > backup_$(date +%Y%m%d).sql
```

### File Backup

```bash
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

## Support

For issues and questions, please refer to:

- ChitUI GitHub: https://github.com/xmodpt/ChitUI_Plus
- Issues: https://github.com/xmodpt/ChitUI_Plus/issues

## License

This plugin repository is part of the ChitUI project and follows the same license.

## Credits

- Built with Bootstrap 5
- Bootstrap Icons
- PHP & MySQL

---

**Made with ❤️ for the ChitUI community**
