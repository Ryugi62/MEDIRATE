const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
};

// 테이블 생성 쿼리
const tables = {
  board: `
    CREATE TABLE IF NOT EXISTS board (
      id INT AUTO_INCREMENT PRIMARY KEY,
      writer VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      filepath VARCHAR(255),
      wdate DATE NOT NULL,
      modified TINYINT(1) NOT NULL,
      isNotice TINYINT(1)
    )`,
  comments: `
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      parent_comment_id INT,
      post_id INT,
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
      username VARCHAR(255),
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

// 데이터베이스 연결 및 테이블 생성
async function initializeDb() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log("Connected to the database.");

    // 각 테이블에 대해 생성 쿼리 실행
    for (const table in tables) {
      await connection.execute(tables[table]);
      console.log(`Table ${table} is ready.`);
    }

    await connection.end();
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

// 데이터베이스 초기화
initializeDb();
