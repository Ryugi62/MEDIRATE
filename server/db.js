// db.js

const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

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
// Soft Delete 패턴: deleted_at 컬럼 추가
// FK 정책: RESTRICT (평가 데이터 보호), SET NULL (게시글/댓글 작성자 보존), CASCADE (관계 테이블)
const expectedColumns = {
  users: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "username", definition: "VARCHAR(255) NOT NULL UNIQUE" },
    { name: "realname", definition: "VARCHAR(255) NOT NULL" },
    { name: "organization", definition: "VARCHAR(255)" },
    { name: "password", definition: "VARCHAR(255) NOT NULL" },
    { name: "role", definition: "ENUM('user', 'admin') NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
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
  // projects와 cancer_types를 assignments보다 먼저 정의 (FK 참조 대상)
  projects: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "name", definition: "VARCHAR(100) NOT NULL" },
    { name: "description", definition: "VARCHAR(255)" },
    { name: "created_by", definition: "INT" },
    {
      name: "creation_date",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY name_unique (name)",
      constraintName: "name_unique",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
      constraintName: "fk_projects_creator",
    },
  ],
  cancer_types: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "code", definition: "VARCHAR(20) NOT NULL" },
    { name: "name_ko", definition: "VARCHAR(50) NOT NULL" },
    { name: "name_en", definition: "VARCHAR(50)" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY code_unique (code)",
      constraintName: "code_unique",
    },
  ],
  assignments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "title", definition: "VARCHAR(255) NOT NULL" },
    {
      name: "creation_date",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "deadline", definition: "DATE NOT NULL" },
    { name: "assignment_type", definition: "VARCHAR(255)" },
    { name: "selection_type", definition: "VARCHAR(255)" },
    {
      name: "assignment_mode",
      definition: "ENUM('TextBox', 'BBox', 'Segment') NOT NULL DEFAULT 'TextBox'",
    },
    { name: "is_score", definition: "BOOLEAN NOT NULL DEFAULT 1" },
    { name: "is_ai_use", definition: "BOOLEAN NOT NULL DEFAULT 1" },
    { name: "evaluation_time", definition: "INT DEFAULT NULL" },
    { name: "project_id", definition: "INT DEFAULT NULL" },
    { name: "cancer_type_id", definition: "INT DEFAULT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
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
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL",
      constraintName: "fk_assignment_project",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (cancer_type_id) REFERENCES cancer_types(id) ON DELETE SET NULL",
      constraintName: "fk_assignment_cancer_type",
    },
  ],
  assignment_user: [
    { name: "assignment_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (assignment_id, user_id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
      constraintName: "fk_assignment_user_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_assignment_user_user",
    },
    // 성능 최적화 인덱스: user_id로 과제 조회 시 사용
    {
      name: "INDEX",
      definition: "INDEX idx_assignment_user_user (user_id)",
      constraintName: "idx_assignment_user_user",
    },
    // deleted_at 필터링 최적화
    {
      name: "INDEX",
      definition: "INDEX idx_assignment_user_deleted (deleted_at)",
      constraintName: "idx_assignment_user_deleted",
    },
  ],
  questions: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "assignment_id", definition: "INT" },
    { name: "image", definition: "VARCHAR(255) NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT",
      constraintName: "fk_questions_assignment",
    },
  ],
  question_responses: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "question_id", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT NOT NULL" },
    { name: "selected_option", definition: "INT NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
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
      definition:
        "FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT",
      constraintName: "fk_question_responses_question",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_question_responses_user",
    },
    // 성능 최적화 인덱스: user_id로 응답 조회 시 사용
    {
      name: "INDEX",
      definition: "INDEX idx_question_responses_user (user_id)",
      constraintName: "idx_question_responses_user",
    },
    // deleted_at 필터링 최적화
    {
      name: "INDEX",
      definition: "INDEX idx_question_responses_deleted (deleted_at)",
      constraintName: "idx_question_responses_deleted",
    },
  ],
  posts: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "user_id", definition: "INT" },
    { name: "title", definition: "VARCHAR(255) NOT NULL" },
    { name: "content", definition: "TEXT NOT NULL" },
    {
      name: "creation_date",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "type", definition: "VARCHAR(255) NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
      constraintName: "fk_posts_user",
    },
  ],
  comments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "post_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "content", definition: "TEXT NOT NULL" },
    { name: "parent_comment_id", definition: "INT" },
    {
      name: "created_at",
      definition:
        "TIMESTAMP DEFAULT CONVERT_TZ(CURRENT_TIMESTAMP, 'UTC', 'Asia/Seoul')",
    },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE",
      constraintName: "fk_comments_post",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
      constraintName: "fk_comments_user",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL",
      constraintName: "fk_comments_parent",
    },
  ],
  attachments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "post_id", definition: "INT" },
    { name: "path", definition: "VARCHAR(255) NOT NULL" },
    { name: "filename", definition: "VARCHAR(255) NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE",
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
    { name: "evaluation_time", definition: "INT DEFAULT 0" },
    { name: "start_time", definition: "TIMESTAMP DEFAULT NULL" },
    { name: "end_time", definition: "TIMESTAMP DEFAULT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT",
      constraintName: "fk_canvas_info_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_canvas_info_user",
    },
    // 성능 최적화 인덱스: user_id로 캔버스 조회 시 사용
    {
      name: "INDEX",
      definition: "INDEX idx_canvas_info_user (user_id)",
      constraintName: "idx_canvas_info_user",
    },
    // assignment_id + user_id 복합 인덱스
    {
      name: "INDEX",
      definition: "INDEX idx_canvas_info_assignment_user (assignment_id, user_id)",
      constraintName: "idx_canvas_info_assignment_user",
    },
    // deleted_at 필터링 최적화
    {
      name: "INDEX",
      definition: "INDEX idx_canvas_info_deleted (deleted_at)",
      constraintName: "idx_canvas_info_deleted",
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
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT",
      constraintName: "fk_squares_info_question",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (canvas_id) REFERENCES canvas_info(id) ON DELETE CASCADE",
      constraintName: "fk_squares_info_canvas",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_squares_info_user",
    },
  ],
  // Segment 모드용 폴리곤 정보 테이블
  polygon_info: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "question_id", definition: "INT" },
    { name: "canvas_id", definition: "INT" },
    { name: "points", definition: "JSON NOT NULL" }, // [{x, y}, {x, y}, ...]
    { name: "user_id", definition: "INT" },
    { name: "isAI", definition: "TINYINT(1) DEFAULT 0" },
    { name: "isTemporary", definition: "TINYINT(1) DEFAULT 0" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT",
      constraintName: "fk_polygon_info_question",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (canvas_id) REFERENCES canvas_info(id) ON DELETE CASCADE",
      constraintName: "fk_polygon_info_canvas",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_polygon_info_user",
    },
  ],
  // 평가자 할당 이력 추적 테이블
  assignment_user_history: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "assignment_id", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT NOT NULL" },
    { name: "action", definition: "ENUM('ASSIGN', 'UNASSIGN') NOT NULL" },
    { name: "performed_by", definition: "INT" }, // 변경한 관리자
    { name: "performed_at", definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    { name: "previous_data", definition: "JSON DEFAULT NULL" }, // 변경 전 데이터 스냅샷 (선택적)
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
      constraintName: "fk_history_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
      constraintName: "fk_history_user",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL",
      constraintName: "fk_history_performer",
    },
  ],
  // Consensus (합의) 모드 관련 테이블
  consensus_assignments: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "title", definition: "VARCHAR(255) NOT NULL" },
    { name: "deadline", definition: "DATE NOT NULL" },
    { name: "source_excel", definition: "VARCHAR(255)" },
    { name: "evaluator_threshold", definition: "INT DEFAULT 3" },
    { name: "score_threshold", definition: "DECIMAL(3,2) DEFAULT 0.50" },
    { name: "assignment_type", definition: "VARCHAR(255)" },
    {
      name: "creation_date",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "project_id", definition: "INT DEFAULT NULL" },
    { name: "cancer_type_id", definition: "INT DEFAULT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL",
      constraintName: "fk_consensus_assignment_project",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (cancer_type_id) REFERENCES cancer_types(id) ON DELETE SET NULL",
      constraintName: "fk_consensus_assignment_cancer_type",
    },
  ],
  consensus_user_assignments: [
    { name: "consensus_assignment_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (consensus_assignment_id, user_id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (consensus_assignment_id) REFERENCES consensus_assignments(id) ON DELETE CASCADE",
      constraintName: "fk_consensus_user_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_consensus_user_user",
    },
  ],
  consensus_fp_squares: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "consensus_assignment_id", definition: "INT NOT NULL" },
    { name: "question_image", definition: "VARCHAR(255) NOT NULL" },
    { name: "x", definition: "INT NOT NULL" },
    { name: "y", definition: "INT NOT NULL" },
    { name: "ai_score", definition: "DECIMAL(4,3) NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (consensus_assignment_id) REFERENCES consensus_assignments(id) ON DELETE CASCADE",
      constraintName: "fk_consensus_fp_assignment",
    },
  ],
  consensus_responses: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "fp_square_id", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT NOT NULL" },
    { name: "response", definition: "ENUM('agree', 'disagree') NOT NULL" },
    {
      name: "responded_at",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY fp_user_unique (fp_square_id, user_id)",
      constraintName: "fp_user_unique",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (fp_square_id) REFERENCES consensus_fp_squares(id) ON DELETE CASCADE",
      constraintName: "fk_consensus_response_fp",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_consensus_response_user",
    },
  ],
  consensus_canvas_info: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "consensus_assignment_id", definition: "INT" },
    { name: "user_id", definition: "INT" },
    { name: "width", definition: "INT DEFAULT 0" },
    { name: "height", definition: "INT DEFAULT 0" },
    { name: "last_question_image", definition: "VARCHAR(255)" },
    { name: "evaluation_time", definition: "INT DEFAULT 0" },
    { name: "start_time", definition: "TIMESTAMP NULL DEFAULT NULL" },
    { name: "end_time", definition: "TIMESTAMP NULL DEFAULT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (consensus_assignment_id) REFERENCES consensus_assignments(id) ON DELETE CASCADE",
      constraintName: "fk_consensus_canvas_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT",
      constraintName: "fk_consensus_canvas_user",
    },
  ],
  // 평가자 그룹 테이블
  evaluator_groups: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "name", definition: "VARCHAR(100) NOT NULL" },
    { name: "description", definition: "VARCHAR(255)" },
    { name: "created_by", definition: "INT" },
    {
      name: "creation_date",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
      constraintName: "fk_evaluator_groups_creator",
    },
  ],
  // 그룹-평가자 다대다 테이블
  evaluator_group_members: [
    { name: "group_id", definition: "INT NOT NULL" },
    { name: "user_id", definition: "INT NOT NULL" },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (group_id, user_id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (group_id) REFERENCES evaluator_groups(id) ON DELETE CASCADE",
      constraintName: "fk_group_members_group",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
      constraintName: "fk_group_members_user",
    },
  ],
  // 태그 테이블 (해시태그 방식)
  tags: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "name", definition: "VARCHAR(50) NOT NULL" },
    { name: "color", definition: "VARCHAR(7) DEFAULT '#666666'" },
    {
      name: "created_at",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY name_unique (name)",
      constraintName: "tags_name_unique",
    },
  ],
  // 과제-태그 연결 테이블
  assignment_tags: [
    { name: "assignment_id", definition: "INT NOT NULL" },
    { name: "tag_id", definition: "INT NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (assignment_id, tag_id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
      constraintName: "fk_assignment_tags_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE",
      constraintName: "fk_assignment_tags_tag",
    },
  ],
  // 합의과제-태그 연결 테이블
  consensus_assignment_tags: [
    { name: "consensus_assignment_id", definition: "INT NOT NULL" },
    { name: "tag_id", definition: "INT NOT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (consensus_assignment_id, tag_id)",
      constraintName: "PRIMARY",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (consensus_assignment_id) REFERENCES consensus_assignments(id) ON DELETE CASCADE",
      constraintName: "fk_consensus_tags_assignment",
    },
    {
      name: "FOREIGN KEY",
      definition:
        "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE",
      constraintName: "fk_consensus_tags_tag",
    },
  ],
  // NIPA 일치 데이터 테이블 (엑셀에서 임포트)
  nipa_match_data: [
    { name: "id", definition: "INT AUTO_INCREMENT" },
    { name: "assignment_type", definition: "VARCHAR(255) NOT NULL" },
    { name: "question_image", definition: "VARCHAR(255) NOT NULL" },
    { name: "match_2", definition: "INT DEFAULT 0" },
    { name: "match_3", definition: "INT DEFAULT 0" },
    { name: "boxes_json", definition: "TEXT DEFAULT NULL" },
    {
      name: "created_at",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    {
      name: "updated_at",
      definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    },
    { name: "deleted_at", definition: "TIMESTAMP NULL DEFAULT NULL" },
    {
      name: "PRIMARY KEY",
      definition: "PRIMARY KEY (id)",
      constraintName: "PRIMARY",
    },
    {
      name: "UNIQUE",
      definition: "UNIQUE KEY type_image_unique (assignment_type, question_image)",
      constraintName: "type_image_unique",
    },
  ],
};

// 초기 테이블 생성 SQL
// Soft Delete 및 FK 정책 적용
// NOTE: 테이블 순서가 중요! FK 참조 대상 테이블이 먼저 정의되어야 함
const createTablesSQL = {
  users: `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INT AUTO_INCREMENT,
    \`username\` VARCHAR(255) NOT NULL UNIQUE,
    \`realname\` VARCHAR(255) NOT NULL,
    \`organization\` VARCHAR(255),
    \`password\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('user', 'admin') NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`users_role_check\` CHECK (\`role\` IN ('user', 'admin'))
  )`,
  // projects와 cancer_types를 assignments보다 먼저 생성 (FK 참조 대상)
  projects: `CREATE TABLE IF NOT EXISTS \`projects\` (
    \`id\` INT AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`description\` VARCHAR(255),
    \`created_by\` INT,
    \`creation_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`name_unique\` (\`name\`),
    FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
  )`,
  cancer_types: `CREATE TABLE IF NOT EXISTS \`cancer_types\` (
    \`id\` INT AUTO_INCREMENT,
    \`code\` VARCHAR(20) NOT NULL,
    \`name_ko\` VARCHAR(50) NOT NULL,
    \`name_en\` VARCHAR(50),
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`code_unique\` (\`code\`)
  )`,
  assignments: `CREATE TABLE IF NOT EXISTS \`assignments\` (
    \`id\` INT AUTO_INCREMENT,
    \`title\` VARCHAR(255) NOT NULL,
    \`creation_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deadline\` DATE NOT NULL,
    \`assignment_type\` VARCHAR(255),
    \`selection_type\` VARCHAR(255),
    \`assignment_mode\` ENUM('TextBox', 'BBox', 'Segment') NOT NULL DEFAULT 'TextBox',
    \`is_score\` BOOLEAN NOT NULL DEFAULT 1,
    \`is_ai_use\` BOOLEAN NOT NULL DEFAULT 1,
    \`evaluation_time\` INT DEFAULT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`title_deadline_unique\` (\`title\`, \`deadline\`)
  )`,
  assignment_user: `CREATE TABLE IF NOT EXISTS \`assignment_user\` (
    \`assignment_id\` INT,
    \`user_id\` INT,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`assignment_id\`, \`user_id\`),
    FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  questions: `CREATE TABLE IF NOT EXISTS \`questions\` (
    \`id\` INT AUTO_INCREMENT,
    \`assignment_id\` INT,
    \`image\` VARCHAR(255) NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE RESTRICT
  )`,
  question_responses: `CREATE TABLE IF NOT EXISTS \`question_responses\` (
    \`id\` INT AUTO_INCREMENT,
    \`question_id\` INT NOT NULL,
    \`user_id\` INT NOT NULL,
    \`selected_option\` INT NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`question_user_unique\` (\`question_id\`, \`user_id\`),
    FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  posts: `CREATE TABLE IF NOT EXISTS \`posts\` (
    \`id\` INT AUTO_INCREMENT,
    \`user_id\` INT,
    \`title\` VARCHAR(255) NOT NULL,
    \`content\` TEXT NOT NULL,
    \`creation_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`type\` VARCHAR(255) NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
  )`,
  comments: `CREATE TABLE IF NOT EXISTS \`comments\` (
    \`id\` INT AUTO_INCREMENT,
    \`post_id\` INT,
    \`user_id\` INT,
    \`content\` TEXT NOT NULL,
    \`parent_comment_id\` INT,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`post_id\`) REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
    FOREIGN KEY (\`parent_comment_id\`) REFERENCES \`comments\`(\`id\`) ON DELETE SET NULL
  )`,
  attachments: `CREATE TABLE IF NOT EXISTS \`attachments\` (
    \`id\` INT AUTO_INCREMENT,
    \`post_id\` INT,
    \`path\` VARCHAR(255) NOT NULL,
    \`filename\` VARCHAR(255) NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`post_id\`) REFERENCES \`posts\`(\`id\`) ON DELETE CASCADE
  )`,
  canvas_info: `CREATE TABLE IF NOT EXISTS \`canvas_info\` (
    \`id\` INT AUTO_INCREMENT,
    \`assignment_id\` INT,
    \`width\` INT NOT NULL,
    \`height\` INT NOT NULL,
    \`lastQuestionIndex\` INT NOT NULL DEFAULT 1,
    \`user_id\` INT,
    \`evaluation_time\` INT DEFAULT 0,
    \`start_time\` TIMESTAMP DEFAULT NULL,
    \`end_time\` TIMESTAMP DEFAULT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  squares_info: `CREATE TABLE IF NOT EXISTS \`squares_info\` (
    \`id\` INT AUTO_INCREMENT,
    \`question_id\` INT,
    \`canvas_id\` INT,
    \`x\` INT NOT NULL,
    \`y\` INT NOT NULL,
    \`user_id\` INT,
    \`isAI\` TINYINT(1) DEFAULT 0,
    \`isTemporary\` TINYINT(1) DEFAULT 0,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`canvas_id\`) REFERENCES \`canvas_info\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  // Segment 모드용 폴리곤 정보 테이블
  polygon_info: `CREATE TABLE IF NOT EXISTS \`polygon_info\` (
    \`id\` INT AUTO_INCREMENT,
    \`question_id\` INT,
    \`canvas_id\` INT,
    \`points\` JSON NOT NULL,
    \`user_id\` INT,
    \`isAI\` TINYINT(1) DEFAULT 0,
    \`isTemporary\` TINYINT(1) DEFAULT 0,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`canvas_id\`) REFERENCES \`canvas_info\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  // 평가자 할당 이력 추적 테이블
  assignment_user_history: `CREATE TABLE IF NOT EXISTS \`assignment_user_history\` (
    \`id\` INT AUTO_INCREMENT,
    \`assignment_id\` INT NOT NULL,
    \`user_id\` INT NOT NULL,
    \`action\` ENUM('ASSIGN', 'UNASSIGN') NOT NULL,
    \`performed_by\` INT,
    \`performed_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`previous_data\` JSON DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`performed_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
    INDEX \`idx_history_assignment\` (\`assignment_id\`),
    INDEX \`idx_history_user\` (\`user_id\`),
    INDEX \`idx_history_performed_at\` (\`performed_at\`)
  )`,
  // Consensus (합의) 모드 관련 테이블
  consensus_assignments: `CREATE TABLE IF NOT EXISTS \`consensus_assignments\` (
    \`id\` INT AUTO_INCREMENT,
    \`title\` VARCHAR(255) NOT NULL,
    \`deadline\` DATE NOT NULL,
    \`source_excel\` VARCHAR(255),
    \`evaluator_threshold\` INT DEFAULT 3,
    \`score_threshold\` DECIMAL(3,2) DEFAULT 0.50,
    \`assignment_type\` VARCHAR(255),
    \`creation_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  )`,
  consensus_user_assignments: `CREATE TABLE IF NOT EXISTS \`consensus_user_assignments\` (
    \`consensus_assignment_id\` INT,
    \`user_id\` INT,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`consensus_assignment_id\`, \`user_id\`),
    FOREIGN KEY (\`consensus_assignment_id\`) REFERENCES \`consensus_assignments\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  consensus_fp_squares: `CREATE TABLE IF NOT EXISTS \`consensus_fp_squares\` (
    \`id\` INT AUTO_INCREMENT,
    \`consensus_assignment_id\` INT NOT NULL,
    \`question_image\` VARCHAR(255) NOT NULL,
    \`x\` INT NOT NULL,
    \`y\` INT NOT NULL,
    \`ai_score\` DECIMAL(4,3) NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`consensus_assignment_id\`) REFERENCES \`consensus_assignments\`(\`id\`) ON DELETE CASCADE,
    INDEX \`idx_consensus_fp\` (\`consensus_assignment_id\`, \`question_image\`)
  )`,
  consensus_responses: `CREATE TABLE IF NOT EXISTS \`consensus_responses\` (
    \`id\` INT AUTO_INCREMENT,
    \`fp_square_id\` INT NOT NULL,
    \`user_id\` INT NOT NULL,
    \`response\` ENUM('agree', 'disagree') NOT NULL,
    \`responded_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`fp_user_unique\` (\`fp_square_id\`, \`user_id\`),
    FOREIGN KEY (\`fp_square_id\`) REFERENCES \`consensus_fp_squares\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  consensus_canvas_info: `CREATE TABLE IF NOT EXISTS \`consensus_canvas_info\` (
    \`id\` INT AUTO_INCREMENT,
    \`consensus_assignment_id\` INT,
    \`user_id\` INT,
    \`width\` INT DEFAULT 0,
    \`height\` INT DEFAULT 0,
    \`last_question_image\` VARCHAR(255),
    \`evaluation_time\` INT DEFAULT 0,
    \`start_time\` TIMESTAMP NULL DEFAULT NULL,
    \`end_time\` TIMESTAMP NULL DEFAULT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`consensus_assignment_id\`) REFERENCES \`consensus_assignments\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  )`,
  // 평가자 그룹 테이블
  evaluator_groups: `CREATE TABLE IF NOT EXISTS \`evaluator_groups\` (
    \`id\` INT AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`description\` VARCHAR(255),
    \`created_by\` INT,
    \`creation_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
  )`,
  // 그룹-평가자 다대다 테이블
  evaluator_group_members: `CREATE TABLE IF NOT EXISTS \`evaluator_group_members\` (
    \`group_id\` INT NOT NULL,
    \`user_id\` INT NOT NULL,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`group_id\`, \`user_id\`),
    FOREIGN KEY (\`group_id\`) REFERENCES \`evaluator_groups\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
  )`,
  // 태그 테이블 (해시태그 방식)
  tags: `CREATE TABLE IF NOT EXISTS \`tags\` (
    \`id\` INT AUTO_INCREMENT,
    \`name\` VARCHAR(50) NOT NULL,
    \`color\` VARCHAR(7) DEFAULT '#666666',
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`tags_name_unique\` (\`name\`)
  )`,
  // 과제-태그 연결 테이블
  assignment_tags: `CREATE TABLE IF NOT EXISTS \`assignment_tags\` (
    \`assignment_id\` INT NOT NULL,
    \`tag_id\` INT NOT NULL,
    PRIMARY KEY (\`assignment_id\`, \`tag_id\`),
    FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON DELETE CASCADE
  )`,
  // 합의과제-태그 연결 테이블
  consensus_assignment_tags: `CREATE TABLE IF NOT EXISTS \`consensus_assignment_tags\` (
    \`consensus_assignment_id\` INT NOT NULL,
    \`tag_id\` INT NOT NULL,
    PRIMARY KEY (\`consensus_assignment_id\`, \`tag_id\`),
    FOREIGN KEY (\`consensus_assignment_id\`) REFERENCES \`consensus_assignments\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON DELETE CASCADE
  )`,
  // NIPA 일치 데이터 테이블 (엑셀에서 임포트)
  nipa_match_data: `CREATE TABLE IF NOT EXISTS \`nipa_match_data\` (
    \`id\` INT AUTO_INCREMENT,
    \`assignment_type\` VARCHAR(255) NOT NULL,
    \`question_image\` VARCHAR(255) NOT NULL,
    \`match_2\` INT DEFAULT 0,
    \`match_3\` INT DEFAULT 0,
    \`boxes_json\` TEXT DEFAULT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    \`deleted_at\` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`type_image_unique\` (\`assignment_type\`, \`question_image\`),
    INDEX \`idx_assignment_type\` (\`assignment_type\`),
    INDEX \`idx_question_image\` (\`question_image\`)
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
      `SHOW DATABASES LIKE '${process.env.DB_NAME}'`
    );
    if (databases.length === 0) {
      await connection.query(`CREATE DATABASE \`${process.env.DB_NAME}\``);
      console.log(`Database '${process.env.DB_NAME}' created.`);
    } else {
      console.log(`Database '${process.env.DB_NAME}' already exists.`);
    }

    // 초기 연결을 종료합니다.
    await connection.end();

    // 이제 풀을 데이터베이스를 포함하여 생성합니다.
    pool = mysql.createPool({
      ...initialConfig,
      database: process.env.DB_NAME,
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
              [process.env.DB_NAME, table]
            );
            if (constraints.length > 0) {
              constraintExists = true;
            }
          } else {
            // 다른 제약 조건 존재 여부 확인
            const [constraints] = await pool.query(
              `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
               WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
              [process.env.DB_NAME, table, constraintName]
            );
            if (constraints.length > 0) {
              constraintExists = true;
            }
          }

          if (!constraintExists) {
            try {
              const alterSQL = `ALTER TABLE \`${table}\` ADD ${constraintDefinition}`;
              await pool.execute(alterSQL);
              console.log(
                `Added constraint '${constraintName}' to table '${table}'.`
              );
            } catch (err) {
              if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_DUP_KEY' || err.code === 'ER_FK_DUP_NAME') {
                console.log(`Constraint '${constraintName}' already exists on table '${table}'.`);
              } else {
                throw err;
              }
            }
          }
        } else if (col.name === "INDEX") {
          // 인덱스 추가
          const indexName = col.constraintName;

          // 인덱스 존재 여부 확인
          const [indexes] = await pool.query(
            `SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [process.env.DB_NAME, table, indexName]
          );

          if (indexes.length === 0) {
            try {
              const alterSQL = `ALTER TABLE \`${table}\` ADD ${col.definition}`;
              await pool.execute(alterSQL);
              console.log(`Added index '${indexName}' to table '${table}'.`);
            } catch (err) {
              if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_DUP_KEY') {
                console.log(`Index '${indexName}' already exists on table '${table}'.`);
              } else {
                throw err;
              }
            }
          }
        } else if (!existingColumnNames.includes(col.name)) {
          // 열 추가
          const alterSQL = `ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.definition}`;
          await pool.execute(alterSQL);
          console.log(`Added column '${col.name}' to table '${table}'.`);
        }
      }
    }

    // Update assignment_mode ENUM to include 'Segment' if not already present
    try {
      await pool.execute(`
        ALTER TABLE assignments
        MODIFY COLUMN assignment_mode ENUM('TextBox', 'BBox', 'Segment') NOT NULL DEFAULT 'TextBox'
      `);
      console.log("Updated 'assignment_mode' ENUM to include 'Segment'.");
    } catch (alterError) {
      // Ignore if column already has the correct definition
      if (!alterError.message.includes("Duplicate")) {
        console.log("assignment_mode ENUM update skipped or already up to date.");
      }
    }

    console.log("Database initialization completed.");
  } catch (error) {
    console.error("Error initializing database:", error);
    // 프로세스를 종료하여 애플리케이션이 계속 실행되지 않도록 합니다.
    process.exit(1);
  }
}

// pool 초기화가 완료될 때까지 대기하는 프로미스를 생성합니다.
const poolReady = initializeDb();

// query 함수를 비동기로 정의하여 pool이 초기화된 후에 쿼리를 실행하도록 합니다.
async function query(sql, params) {
  // pool이 초기화될 때까지 대기합니다.
  await poolReady;
  return pool.query(sql, params);
}

// 트랜잭션 헬퍼 함수
async function withTransaction(callback) {
  await poolReady;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Soft Delete 헬퍼 함수
async function softDelete(table, id, connection = null) {
  const sql = `UPDATE \`${table}\` SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`;
  const executor = connection || pool;
  await poolReady;
  return executor.query(sql, [id]);
}

// 활성 레코드만 조회하는 기본 조건
const activeOnly = "deleted_at IS NULL";

// module.exports에 query 함수를 포함시킵니다.
module.exports = {
  query,
  withTransaction,
  softDelete,
  activeOnly,
};
