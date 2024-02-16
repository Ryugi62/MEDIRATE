const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// 데이터베이스 연결 풀 설정
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

// 초기 테이블 생성
const createTablesSQL = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        realname VARCHAR(255) NOT NULL,
        organization VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') NOT NULL,
        CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
    )`,
  assignments: `
    CREATE TABLE IF NOT EXISTS assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        deadline DATE NOT NULL,
        assignment_type VARCHAR(255),
        selection_type VARCHAR(255),
        UNIQUE KEY title_deadline_unique (title, deadline)
    )`,
  assignment_user: `
    CREATE TABLE IF NOT EXISTS assignment_user (
        assignment_id INT,
        user_id INT,
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (assignment_id, user_id)
    )`,
  questions: `
    CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assignment_id INT,
        image VARCHAR(255) NOT NULL,
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
    )`,
  question_responses: `
    CREATE TABLE IF NOT EXISTS question_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        user_id INT NOT NULL,
        selected_option INT NOT NULL,
        FOREIGN KEY (question_id) REFERENCES questions(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE KEY question_user_unique (question_id, user_id)
    );
  `,
  user_answers: `
    CREATE TABLE IF NOT EXISTS user_answers (
        question_id INT,
        user_id INT,
        selected_index INT,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (question_id, user_id)
    )`,
  posts: `
    CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  comments: `
    CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT,
        user_id INT,
        content TEXT NOT NULL,
        parent_comment_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL
    )`,
  attachments: `
    CREATE TABLE IF NOT EXISTS attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT,
        path VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )`,
};

// 데이터베이스 초기화 및 테이블 생성 함수
async function initializeDb() {
  try {
    for (const table in createTablesSQL) {
      await pool.execute(createTablesSQL[table]);
      console.log(`Table ${table} is ready.`);
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// 애플리케이션 시작 시 데이터베이스 초기화
initializeDb();

module.exports = pool;
