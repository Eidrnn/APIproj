-- FitCoach Expenditure Tracker: database setup with sample data.
-- WARNING: this drops and recreates the `fitcoach` database. Run it only on a
-- fresh setup, or when you want to reset the sample data.

DROP DATABASE IF EXISTS fitcoach;
CREATE DATABASE fitcoach;
USE fitcoach;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  monthly_allowance DECIMAL(10,2) NOT NULL
);

CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255)
);

CREATE TABLE expenses (
  expense_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATETIME NOT NULL,
  description VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

INSERT INTO users (full_name, email, monthly_allowance) VALUES
  ('Wanjiru Kamau', 'wanjiru.kamau@example.com', 8000),
  ('Brian Otieno', 'brian.otieno@example.com', 5000);

INSERT INTO categories (name, description) VALUES
  ('Gym Membership', 'Recurring monthly gym or fitness club membership fees'),
  ('Equipment', 'Fitness equipment purchases'),
  ('Classes', 'Fitness classes and training sessions');

INSERT INTO expenses (user_id, category_id, amount, expense_date, description) VALUES
  (1, 1, 1500, '2026-10-03 10:00:00', 'October gym membership'),
  (1, 2, 2200, '2026-10-07 14:30:00', 'Resistance bands'),
  (1, 3, 800, '2026-09-20 18:00:00', 'Yoga class');
