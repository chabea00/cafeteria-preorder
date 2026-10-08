CREATE DATABASE IF NOT EXISTS cafeteria_preorder
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafeteria_preorder;

-- Data minimisation (RA 10173): only what a screen or report reads.
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  student_no    VARCHAR(20)  NOT NULL UNIQUE,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','staff','admin') NOT NULL DEFAULT 'student',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(80)  NOT NULL,
  category  VARCHAR(40)  NOT NULL,
  price     DECIMAL(8,2) NOT NULL CHECK (price >= 0),
  available TINYINT(1)   NOT NULL DEFAULT 1
);

CREATE TABLE orders (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  reference_no VARCHAR(20) NOT NULL UNIQUE,
  user_id      INT NOT NULL,
  pickup_time  TIME NOT NULL,
  note         VARCHAR(200) NOT NULL DEFAULT '',
  total        DECIMAL(9,2) NOT NULL,
  status       ENUM('pending','preparing','ready','picked_up','cancelled')
               NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_orders_user_status (user_id, status),
  INDEX idx_orders_status_pickup (status, pickup_time)
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

INSERT INTO menu_items (name, category, price) VALUES
 ('Chicken adobo with rice', 'Meals', 75.00),
 ('Pork sinigang with rice', 'Meals', 80.00),
 ('Vegetable pancit', 'Meals', 55.00),
 ('Egg sandwich', 'Snacks', 35.00),
 ('Banana cue (2 pcs)', 'Snacks', 20.00),
 ('Bottled water', 'Drinks', 15.00),
 ('Iced tea', 'Drinks', 25.00);
