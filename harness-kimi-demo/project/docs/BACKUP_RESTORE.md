# Backup and Restore

This document describes how to back up and restore the Lumina SQLite database.

## Default Database Location

By default, the backend uses a SQLite database file located at:

```
project/backend/lumina.db
```

This path is configured in `project/backend/app/core/config.py` via the `DATABASE_URL` environment variable.

## Backing Up the Database

To create a backup, simply copy the SQLite database file to a safe location. It is recommended to stop the backend server before copying to ensure data consistency.

### Example Commands

```bash
# Navigate to the backend directory
cd project/backend

# Create a timestamped backup
cp lumina.db "lumina.db.backup.$(date +%Y%m%d_%H%M%S)"

# Or copy to an external drive
cp lumina.db /path/to/external/drive/lumina.db.backup
```

## Restoring the Database

To restore from a backup, replace the current database file with your backup copy and restart the backend server.

### Example Commands

```bash
# Navigate to the backend directory
cd project/backend

# Stop the running backend server first

# Replace the current database with the backup
cp lumina.db.backup.20260417_120000 lumina.db

# Restart the backend server
uvicorn main:app --reload --port 8000
```

## Important Notes

- **Always stop the backend server** before copying or replacing the database file to avoid corruption.
- SQLite databases are single files, so standard file copy operations are sufficient.
- Keep multiple timestamped backups for point-in-time recovery.
- If you change `DATABASE_URL` to a different path, adjust the commands above accordingly.
