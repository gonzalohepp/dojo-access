---
description: Create dashboard_stats view for Admin Dashboard
---

This workflow recreates the `dashboard_stats` view which is required for the main Admin Dashboard to function correctly.

1. Execute the SQL definition.
// turbo
2. Create the view using psql.
```bash
psql "$SUPABASE_DB_URL" -f fix_dashboard_stats.sql
```
