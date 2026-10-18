-- Run once on an existing database (keeps all your data). New installs: use schema.sql instead.
USE cafeteria_preorder;
ALTER TABLE menu_items ADD COLUMN description VARCHAR(200) NOT NULL DEFAULT '' AFTER category;
