-- 4Kautos — one-time MySQL setup (run as root)
-- Creates the app + test databases and a dedicated least-privilege user.
-- The app connects as `kautos_app`, NOT root, so root credentials stay out of .env.

CREATE DATABASE IF NOT EXISTS `4kautos`      CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS `4kautos_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- mysql_native_password keeps auth simple over a plain local TCP connection.
CREATE USER IF NOT EXISTS 'kautos_app'@'localhost'
  IDENTIFIED WITH mysql_native_password BY 'Kautos4DevLocalOnly';

GRANT ALL PRIVILEGES ON `4kautos`.*      TO 'kautos_app'@'localhost';
GRANT ALL PRIVILEGES ON `4kautos_test`.* TO 'kautos_app'@'localhost';
FLUSH PRIVILEGES;
