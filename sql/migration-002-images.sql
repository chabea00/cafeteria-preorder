-- Run once on an existing database (keeps all your data). New installs: use schema.sql instead.
USE cafeteria_preorder;
ALTER TABLE stalls     ADD COLUMN logo  VARCHAR(80) NULL AFTER description;
ALTER TABLE menu_items ADD COLUMN image VARCHAR(80) NULL AFTER daily_limit;
