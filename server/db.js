const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// 데이터베이스 이름을 상수로 정의합니다.
const DATABASE_NAME = "medirate";

// 초기 연결 설정 (데이터베이스 없이 연결)
const initialConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
  multipleStatements: true, // 여러 쿼리를 한 번에 실행할 수 있게 설정
};

// 최상위 수준에서 pool을 선언합니다. (나중에 데이터베이스를 지정할 예정)
let pool;

// 각 테이블의 예상 열 정의
const expectedColumns = {
  users: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "username", definition: "VARCHAR(255) NOT NULL UNIQUE" },
    { name: "realname", definition: "VARCHAR(255) NOT NULL" },
    { name: "organization", definition: "VARCHAR(255)" },
    { name: "password", definition: "VARCHAR(255) NOT NULL" },
    { name: "role", definition: "ENUM('user', 'admin') NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "CHECK",
      definition:
        "CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))",
      constraintName: "users_role_check",
    },
  ],
  assignments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
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
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY title_deadline_unique (title, deadline)",
      constraintName: "title_deadline_unique",
    },
  ],
  assignment_user: [
    { name: "assignment_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (assignment_id, user_id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE",
      constraintName: "fk_assignment_user_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE",
      constraintName: "fk_assignment_user_user",
    },
  ],
  questions: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "assignment_id", definition: "INT" },
    { name: "image", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE",
      constraintName: "fk_questions_assignment",
    },
  ],
  question_responses: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "question_id", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT NOT NULL" },
    { name: "selected_option", definition: "INT NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY question_user_unique (question_id, user_id)",
      constraintName: "question_user_unique",
    },
    {
      name: "FOREIGN KEY",
      definition: "FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`)",
      constraintName: "fk_question_responses_question",
    },
    {
      name: "FOREIGN KEY",
      definition: "FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)",
      constraintName: "fk_question_responses_user",
    },
  ],
  posts: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "user_id", definition: "INT" },
    { name: "title", definition: "VARCHAR(255) NOT NULL" },
    { name: "content", definition: "TEXT NOT NULL" },
    { name: "creation_date", definition: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    { name: "type", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE",
      constraintName: "fk_posts_user",
    },
  ],
  comments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "post_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "content", definition: "TEXT NOT NULL" },
    { name: "parent_comment_id", definition: "INT" },
    { name: "created_at", definition: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE",
      constraintName: "fk_comments_post",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE",
      constraintName: "fk_comments_user",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`parent_comment_id`) REFERENCES `comments`(`id`) ON DELETE SET NULL",
      constraintName: "fk_comments_parent",
    },
  ],
  attachments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "post_id", definition: "INT" },
    { name: "path", definition: "VARCHAR(255) NOT NULL" },
    { name: "filename", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE",
      constraintName: "fk_attachments_post",
    },
  ],
  canvas_info: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "assignment_id", definition: "INT" },
    { name: "width", definition: "INT NOT NULL" },
    { name: "height", definition: "INT NOT NULL" },
    { name: "lastQuestionIndex", definition: "INT NOT NULL DEFAULT 1" },
    { name: "user_id", definition: "INT" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE",
      constraintName: "fk_canvas_info_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE",
      constraintName: "fk_canvas_info_user",
    },
  ],
  squares_info: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "question_id", definition: "INT" },
    { name: "canvas_id", definition: "INT" },
    { name: "x", definition: "INT NOT NULL" },
    { name: "y", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT" },
    { name: "isAI", definition: "TINYINT(1) DEFAULT 0" },
    { name: "isTemporary", definition: "TINYINT(1) DEFAULT 0" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE",
      constraintName: "fk_squares_info_question",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`canvas_id`) REFERENCES `canvas_info`(`id`) ON DELETE CASCADE",
      constraintName: "fk_squares_info_canvas",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE",
      constraintName: "fk_squares_info_user",
    },
  ],
};

// 초기 테이블 생성 SQL
const createTablesSQL = {
  users: `
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` INT AUTO_INCREMENT,
      \`username\` VARCHAR(255) NOT NULL UNIQUE,
      \`realname\` VARCHAR(255) NOT NULL,
      \`organization\` VARCHAR(255),
      \`password\` VARCHAR(255) NOT NULL,
      \`role\` ENUM('user', 'admin') NOT NULL,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`users_role_check\` CHECK (\`role\` IN ('user', 'admin'))
    )`,
  assignments: `
    CREATE TABLE IF NOT EXISTS \`assignments\` (
      \`id\` INT AUTO_INCREMENT,
      \`title\` VARCHAR(255) NOT NULL,
      \`creation_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`deadline\` DATE NOT NULL,
      \`assignment_type\` VARCHAR(255),
      \`selection_type\` VARCHAR(255),
      \`assignment_mode\` ENUM('TextBox', 'BBox') NOT NULL DEFAULT 'TextBox',
      \`is_score\` BOOLEAN NOT NULL DEFAULT 1,
      \`is_ai_use\` BOOLEAN NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`title_deadline_unique\` (\`title\`, \`deadline\`)
    )`,
  assignment_user: `
    CREATE TABLE IF NOT EXISTS \`assignment_user\` (
      \`assignment_id\` INT,
      \`user_id\` INT,
      PRIMARY KEY (\`assignment_id\`, \`user_id\`),
      FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    )`,
  questions: `
    CREATE TABLE IF NOT EXISTS \`questions\` (
      \`id\` INT AUTO_INCREMENT,
      \`assignment_id\` INT,
      \`image\` VARCHAR(255) NOT NULL,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE CASCADE
    )`,
  question_responses: `
    CREATE TABLE IF NOT EXISTS \`question_responses\` (
      \`id\` INT AUTO_INCREMENT,
      \`question_id\` INT NOT NULL,
      \`user_id\` INT NOT NULL,
      \`selected_option\` INT NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`question_user_unique\` (\`question_id\`, \`user_id\`),
      FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`id\`),
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
    )`,
  posts: `
    CREATE TABLE IF NOT EXISTS \`posts\` (
      \`id\` INT AUTO_INCREMENT,
      \`user_id\` INT,
      \`title\` VARCHAR(255) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`creation_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`type\` VARCHAR(255) NOT NULL,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    )`,
  comments: `
    CREATE TABLE IF NOT EXISTS \`comments\` (
      \`id\` INT AUTO_INCREMENT,
      \`post_id\` INT,
      \`user_id\` INT,
      \`content\` TEXT NOT NULL,
      \`parent_comment_id\` INT,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`post_id\`) REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`parent_comment_id\`) REFERENCES \`comments\`(\`id\`) ON DELETE SET NULL
    )`,
  attachments: `
    CREATE TABLE IF NOT EXISTS \`attachments\` (
      \`id\` INT AUTO_INCREMENT,
      \`post_id\` INT,
      \`path\` VARCHAR(255) NOT NULL,
      \`filename\` VARCHAR(255) NOT NULL,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`post_id\`) REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE
    )`,
  canvas_info: `
    CREATE TABLE IF NOT EXISTS \`canvas_info\` (
      \`id\` INT AUTO_INCREMENT,
      \`assignment_id\` INT,
      \`width\` INT NOT NULL,
      \`height\` INT NOT NULL,
      \`lastQuestionIndex\` INT NOT NULL DEFAULT 1,
      \`user_id\` INT,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    )`,
  squares_info: `
    CREATE TABLE IF NOT EXISTS \`squares_info\` (
      \`id\` INT AUTO_INCREMENT,
      \`question_id\` INT,
      \`canvas_id\` INT,
      \`x\` INT NOT NULL,
      \`y\` INT NOT NULL,
      \`user_id\` INT,
      \`isAI\` TINYINT(1) DEFAULT 0,
      \`isTemporary\` TINYINT(1) DEFAULT 0,
      PRIMARY KEY (\`id\`),
      FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`canvas_id\`) REFERENCES \`canvas_info\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    )`,
};

// 데이터베이스 및 테이블 초기화 함수
async function initializeDb() {
  let connection;
  try {
    // 초기 연결을 생성 (데이터베이스 없이)
    connection = await mysql.createConnection(initialConfig);
    console.log("Connected to MySQL server.");

    // 데이터베이스가 존재하는지 확인하고 없으면 생성
    const [databases] = await connection.query(
      `SHOW DATABASES LIKE '${DATABASE_NAME}'`
    );
    if (databases.length === 0) {
      await connection.query(`CREATE DATABASE \`${DATABASE_NAME}\``);
      console.log(`Database '${DATABASE_NAME}' created.`);
    } else {
      console.log(`Database '${DATABASE_NAME}' already exists.`);
    }

    // 초기 연결을 종료합니다.
    await connection.end();

    // 이제 풀을 데이터베이스를 포함하여 생성합니다.
    pool = mysql.createPool({
      ...initialConfig,
      database: DATABASE_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log("Connection pool created.");

    // 각 테이블을 생성하거나 업데이트합니다.
    for (const table in createTablesSQL) {
      // 테이블 생성
      await pool.execute(createTablesSQL[table]);
      console.log(`Table '${table}' is ready.`);

      // 기존 열 가져오기
      const [existingColumns] = await pool.query(`DESCRIBE \`${table}\``);
      const existingColumnNames = existingColumns.map((col) => col.Field);

      // 예상 열 가져오기
      const expectedCols = expectedColumns[table];

      // 예상 열과 기존 열 비교하여 누락된 열 추가
      for (const col of expectedCols) {
        if (
          col.name === "PRIMARY KEY" ||
          col.name === "UNIQUE" ||
          col.name === "CHECK" ||
          col.name === "FOREIGN KEY"
        ) {
          // 제약 조건 추가
          const constraintDefinition = col.definition;
          const constraintName = col.constraintName;

          // 제약 조건이 이미 있는지 확인
          let constraintExists = false;

          if (col.name === "PRIMARY KEY") {
            // PRIMARY KEY 존재 여부 확인
            const [constraints] = await pool.query(
              `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'PRIMARY KEY'`,
              [DATABASE_NAME, table]
            );
            if (constraints.length > 0) {
              constraintExists = true;
            }
          } else {
            // 다른 제약 조건 존재 여부 확인
            const [constraints] = await pool.query(
              `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
              [DATABASE_NAME, table, constraintName]
            );
            if (constraints.length > 0) {
              constraintExists = true;
            }
          }

          if (!constraintExists) {
            const alterSQL = `ALTER TABLE \`${table}\` ADD ${constraintDefinition}`;
            await pool.execute(alterSQL);
            console.log(
              `Added constraint '${constraintName}' to table '${table}'.`
            );
          }
        } else if (!existingColumnNames.includes(col.name)) {
          // 열 추가
          const alterSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.definition}`;
          await pool.execute(alterSQL);
          console.log(`Added column '${col.name}' to table '${table}'.`);
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
