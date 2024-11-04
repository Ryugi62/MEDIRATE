const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// 데이터베이스 연결 풀 설정
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
});

// 각 테이블의 예상 열 정의
const expectedColumns = {
  users: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "username", definition: "VARCHAR(255) NOT NULL UNIQUE" },
    { name: "realname", definition: "VARCHAR(255) NOT NULL" },
    { name: "organization", definition: "VARCHAR(255)" },
    { name: "password", definition: "VARCHAR(255) NOT NULL" },
    { name: "role", definition: "ENUM('user', 'admin') NOT NULL" },
    {
      name: "CONSTRAINT",
      definition: "users_role_check CHECK (role IN ('user', 'admin'))",
    },
  ],
  assignments: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "title", definition: "VARCHAR(255) NOT NULL" },
    { name: "creation_date", definition: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { name: "deadline", definition: "DATE NOT NULL" },
    { name: "assignment_type", definition: "VARCHAR(255)" },
    { name: "selection_type", definition: "VARCHAR(255)" },
    {
      name: "assignment_mode",
      definition: "ENUM('TextBox', 'BBox') NOT NULL DEFAULT 'TextBox'",
    },
    { name: "is_score", definition: "BOOLEAN NOT NULL DEFAULT 1" },
    { name: "is_ai_use", definition: "BOOLEAN NOT NULL DEFAULT 1" },
    { name: "UNIQUE", definition: "(title, deadline)" },
  ],
  assignment_user: [
    { name: "assignment_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "PRIMARY KEY", definition: "(assignment_id, user_id)" },
    {
      name: "FOREIGN KEY",
      definition:
        "(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
    },
    {
      name: "FOREIGN KEY",
      definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE",
    },
  ],
  questions: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "assignment_id", definition: "INT" },
    { name: "image", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "FOREIGN KEY",
      definition:
        "(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
    },
  ],
  question_responses: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "question_id", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT NOT NULL" },
    { name: "selected_option", definition: "INT NOT NULL" },
    { name: "UNIQUE", definition: "(question_id, user_id)" },
    {
      name: "FOREIGN KEY",
      definition: "(question_id) REFERENCES questions(id)",
    },
    { name: "FOREIGN KEY", definition: "(user_id) REFERENCES users(id)" },
  ],
  posts: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "user_id", definition: "INT" },
    { name: "title", definition: "VARCHAR(255) NOT NULL" },
    { name: "content", definition: "TEXT NOT NULL" },
    { name: "creation_date", definition: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { name: "type", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "FOREIGN KEY",
      definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE",
    },
  ],
  comments: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "post_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "content", definition: "TEXT NOT NULL" },
    { name: "parent_comment_id", definition: "INT" },
    { name: "created_at", definition: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    {
      name: "FOREIGN KEY",
      definition: "(post_id) REFERENCES posts(id) ON DELETE CASCADE",
    },
    {
      name: "FOREIGN KEY",
      definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "(parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL",
    },
  ],
  attachments: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "post_id", definition: "INT" },
    { name: "path", definition: "VARCHAR(255) NOT NULL" },
    { name: "filename", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "FOREIGN KEY",
      definition: "(post_id) REFERENCES posts(id) ON DELETE CASCADE",
    },
  ],
  canvas_info: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "assignment_id", definition: "INT" },
    { name: "width", definition: "INT NOT NULL" },
    { name: "height", definition: "INT NOT NULL" },
    { name: "lastQuestionIndex", definition: "INT NOT NULL DEFAULT 1" },
    { name: "user_id", definition: "INT" },
    {
      name: "FOREIGN KEY",
      definition:
        "(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
    },
    {
      name: "FOREIGN KEY",
      definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE",
    },
  ],
  squares_info: [
    { name: "id", definition: "INT AUTO_INCREMENT PRIMARY KEY" },
    { name: "question_id", definition: "INT" },
    { name: "canvas_id", definition: "INT" },
    { name: "x", definition: "INT NOT NULL" },
    { name: "y", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT" },
    { name: "isAI", definition: "TINYINT(1) DEFAULT 0" },
    { name: "isTemporary", definition: "TINYINT(1) DEFAULT 0" },
    {
      name: "FOREIGN KEY",
      definition: "(question_id) REFERENCES questions(id) ON DELETE CASCADE",
    },
    {
      name: "FOREIGN KEY",
      definition: "(canvas_id) REFERENCES canvas_info(id) ON DELETE CASCADE",
    },
    {
      name: "FOREIGN KEY",
      definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE",
    },
  ],
};

// 초기 테이블 생성 SQL
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
      assignment_mode ENUM('TextBox', 'BBox') NOT NULL DEFAULT 'TextBox',
      is_score BOOLEAN NOT NULL DEFAULT 1,
      is_ai_use BOOLEAN NOT NULL DEFAULT 1,
      UNIQUE KEY title_deadline_unique (title, deadline)
    )`,
  assignment_user: `
    CREATE TABLE IF NOT EXISTS assignment_user (
      assignment_id INT,
      user_id INT,
      PRIMARY KEY (assignment_id, user_id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
      UNIQUE KEY question_user_unique (question_id, user_id),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
  posts: `
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      type VARCHAR(255) NOT NULL,
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
  canvas_info: `
    CREATE TABLE IF NOT EXISTS canvas_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT,
      width INT NOT NULL,
      height INT NOT NULL,
      lastQuestionIndex INT NOT NULL DEFAULT 1,
      user_id INT,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  squares_info: `
    CREATE TABLE IF NOT EXISTS squares_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question_id INT,
      canvas_id INT,
      x INT NOT NULL,
      y INT NOT NULL,
      user_id INT,
      isAI TINYINT(1) DEFAULT 0,
      isTemporary TINYINT(1) DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (canvas_id) REFERENCES canvas_info(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
};

// 데이터베이스 초기화 및 테이블 생성 함수
async function initializeDb() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`CREATE DATABASE IF NOT EXISTS medirate`);
    await connection.query(`USE medirate`);

    // 테이블 생성 및 열 확인
    for (const table in createTablesSQL) {
      // 테이블 생성
      await pool.execute(createTablesSQL[table]);
      console.log(`Table ${table} is ready.`);

      // 기존 열 가져오기
      const [existingColumns] = await pool.query(`DESCRIBE ${table}`);
      const existingColumnNames = existingColumns.map((col) => col.Field);

      // 예상 열 가져오기
      const expectedCols = expectedColumns[table];

      // 예상 열과 기존 열 비교하여 누락된 열 추가
      for (const col of expectedCols) {
        if (
          col.name === "CONSTRAINT" ||
          col.name === "UNIQUE" ||
          col.name === "PRIMARY KEY" ||
          col.name === "FOREIGN KEY"
        ) {
          // 제약 조건 추가
          // 제약 조건이 이미 있는지 확인
          const constraintName = col.definition.split(" ")[0];
          const [constraints] = await pool.query(`
            SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND CONSTRAINT_NAME = '${constraintName}'
          `);
          if (constraints.length === 0) {
            const alterSQL = `ALTER TABLE ${table} ADD ${col.name} ${col.definition}`;
            await pool.execute(alterSQL);
            console.log(`Added constraint to table ${table}`);
          }
        } else if (!existingColumnNames.includes(col.name)) {
          // 열 추가
          const alterSQL = `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.definition}`;
          await pool.execute(alterSQL);
          console.log(`Added column ${col.name} to table ${table}`);
        }
      }
    }

    connection.release();
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// 애플리케이션 시작 시 데이터베이스 초기화
initializeDb();

module.exports = pool;