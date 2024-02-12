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
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 초기 테이블 생성
const createTablesSQL = {
  board: `
    CREATE TABLE IF NOT EXISTS board (
      id INT AUTO_INCREMENT PRIMARY KEY,
      writer VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      filepath VARCHAR(255),
      wdate DATE NOT NULL,
      modified TINYINT(1) NOT NULL DEFAULT 0,
      isNotice TINYINT(1) DEFAULT 0
    )`,
  comments: `
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      parent_comment_id INT DEFAULT NULL,
      post_id INT DEFAULT NULL,
      modified TINYINT(1) DEFAULT 0
    )`,
  filename: `
    CREATE TABLE IF NOT EXISTS filename (
      id INT AUTO_INCREMENT PRIMARY KEY,
      board_detail_id INT,
      filename VARCHAR(255) NOT NULL
    )`,
  user_credentials: `
    CREATE TABLE IF NOT EXISTS user_credentials (
      username VARCHAR(255) PRIMARY KEY,
      realname VARCHAR(255),
      encrypted_password VARCHAR(255),
      organization VARCHAR(255)
    )`,
  t_assignment: `
    CREATE TABLE IF NOT EXISTS t_assignment (
      id INT AUTO_INCREMENT PRIMARY KEY,
      FileName VARCHAR(255),
      CreationDate DATE,
      Deadline DATE,
      FileType VARCHAR(50),
      SelectionStatus VARCHAR(50),
      User VARCHAR(255),
      isCompleted TINYINT(1) DEFAULT 0
    )`,
  t_assignmentitem: `
    CREATE TABLE IF NOT EXISTS t_assignmentitem (
      assignmentID VARCHAR(255) NOT NULL,
      sequence INT NOT NULL,
      imageFile VARCHAR(255),
      PRIMARY KEY (assignmentID, sequence)
    )`,
  assignmentuserrelation: `
    CREATE TABLE IF NOT EXISTS assignmentuserrelation (
      RelationID INT AUTO_INCREMENT PRIMARY KEY,
      AssignmentID INT,
      Username VARCHAR(255),
      Screening INT DEFAULT -1
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
