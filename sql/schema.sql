CREATE DATABASE IF NOT EXISTS cafeteria_preorder
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafeteria_preorder;

-- Data minimisation (RA 10173): only what a screen or report reads.
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  student_no    VARCHAR(20) NULL UNIQUE,          -- students only; stall owners log in by e-mail
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','stall','admin') NOT NULL DEFAULT 'student',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stalls (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE,
  name        VARCHAR(80) NOT NULL UNIQUE,
  location    VARCHAR(80)  NOT NULL DEFAULT '',   -- shown to students, e.g. "Left side, near the entrance"
  description VARCHAR(200) NOT NULL DEFAULT '',
  logo        VARCHAR(80)  NULL,                  -- uploaded logo file name
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stalls_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE menu_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  stall_id        INT NOT NULL,
  name            VARCHAR(80)  NOT NULL,
  category        VARCHAR(40)  NOT NULL,
  price           DECIMAL(8,2) NOT NULL CHECK (price >= 0),
  available       TINYINT(1)   NOT NULL DEFAULT 1,
  max_per_student INT NULL CHECK (max_per_student BETWEEN 1 AND 10),  -- most one student may order at once
  daily_limit     INT NULL CHECK (daily_limit >= 1),                  -- most pre-orders accepted per day
  image           VARCHAR(80)  NULL,                                  -- uploaded photo file name
  deleted         TINYINT(1)   NOT NULL DEFAULT 0,                    -- soft delete keeps order history intact
  CONSTRAINT fk_menu_stall FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE,
  INDEX idx_menu_stall (stall_id, deleted, category)
);

CREATE TABLE orders (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  reference_no VARCHAR(20) NOT NULL UNIQUE,
  user_id      INT NOT NULL,
  stall_id     INT NOT NULL,
  pickup_time  TIME NOT NULL,
  note         VARCHAR(200) NOT NULL DEFAULT '',
  total        DECIMAL(9,2) NOT NULL,
  status       ENUM('pending','preparing','ready','picked_up','cancelled')
               NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_orders_stall FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE,
  INDEX idx_orders_user_status (user_id, status),
  INDEX idx_orders_stall_status (stall_id, status, pickup_time)
);

CREATE TABLE order_items (
  order_id     INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity     INT NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price   DECIMAL(8,2) NOT NULL,  -- price at time of order
  PRIMARY KEY (order_id, menu_item_id),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_menu  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);
