const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// 데이터베이스 연결 풀을 전역 변수로 선언
let pool;

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
      name: "CHECK",
      definition:
        "CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))",
      constraintName: "users_role_check",
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
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY title_deadline_unique (title, deadline)",
      constraintName: "title_deadline_unique",
    },
  ],
  // 다른 테이블들도 동일하게 수정해주세요.
  // 예시로 assignment_user 테이블을 추가합니다.
  assignment_user: [
    { name: "assignment_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "PRIMARY KEY", definition: "PRIMARY KEY (assignment_id, user_id)" },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
      constraintName: "fk_assignment_user_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
      constraintName: "fk_assignment_user_user",
    },
  ],
  // 나머지 테이블들도 동일하게 정의합니다.
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
  // 나머지 테이블들도 동일하게 추가해주세요.
};

// 데이터베이스 초기화 및 테이블 생성 함수
async function initializeDb() {
  try {
    // 데이터베이스가 없으면 생성
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS medirate`);
    connection.end();

    // 이제 데이터베이스를 지정하여 새로운 풀을 생성합니다.
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: "medirate", // 데이터베이스 지정
      port: process.env.DB_PORT || 3306,
    });

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
          col.name === "CHECK" ||
          col.name === "UNIQUE" ||
          col.name === "PRIMARY KEY" ||
          col.name === "FOREIGN KEY"
        ) {
          // 제약 조건 추가
          const constraintDefinition = col.definition;
          let constraintName = col.constraintName;

          if (!constraintName) {
            // 제약 조건 이름이 없는 경우 정의에서 추출
            const constraintNameMatch =
              constraintDefinition.match(/CONSTRAINT\s+(\w+)/i);
            constraintName = constraintNameMatch
              ? constraintNameMatch[1]
              : null;
          }

          if (!constraintName) {
            // 제약 조건 이름이 없는 경우 정의 전체를 해시하여 이름 생성
            constraintName = `constraint_${Buffer.from(constraintDefinition)
              .toString("hex")
              .slice(0, 16)}`;
          }

          // 제약 조건이 이미 있는지 확인
          const [constraints] = await pool.query(
            `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
            [table, constraintName]
          );
          if (constraints.length === 0) {
            const alterSQL = `ALTER TABLE ${table} ADD ${constraintDefinition}`;
            await pool.execute(alterSQL);
            console.log(`Added constraint ${constraintName} to table ${table}`);
          }
        } else if (!existingColumnNames.includes(col.name)) {
          // 열 추가
          const alterSQL = `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.definition}`;
          await pool.execute(alterSQL);
          console.log(`Added column ${col.name} to table ${table}`);
        }
      }
    }

    console.log("Database initialization completed.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// 애플리케이션 시작 시 데이터베이스 초기화
initializeDb();

// pool을 모듈로 내보냅니다.
module.exports = pool;
