-- MEDIRATE DB 성능 최적화를 위한 인덱스 추가
-- MySQL 5.7+ 호환 버전 (IF NOT EXISTS 제거)

-- 기존 인덱스가 있는지 확인하고 없는 경우에만 생성
SET @sql = '';

-- 1. assignments 테이블 인덱스 (대시보드 필터링용)
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'assignments' AND index_name = 'idx_assignments_mode_cancer_folder';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_assignments_mode_cancer_folder ON assignments(assignment_mode, cancer_type, folder_name)',
    'SELECT "Index idx_assignments_mode_cancer_folder already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- assignments 생성날짜 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'assignments' AND index_name = 'idx_assignments_creation_date';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_assignments_creation_date ON assignments(creation_date DESC)',
    'SELECT "Index idx_assignments_creation_date already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. canvas_info 테이블 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'canvas_info' AND index_name = 'idx_canvas_info_assignment_id';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_canvas_info_assignment_id ON canvas_info(assignment_id)',
    'SELECT "Index idx_canvas_info_assignment_id already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- canvas_info 종료시간 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'canvas_info' AND index_name = 'idx_canvas_info_assignment_end_time';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_canvas_info_assignment_end_time ON canvas_info(assignment_id, end_time)',
    'SELECT "Index idx_canvas_info_assignment_end_time already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. assignment_user 테이블 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'assignment_user' AND index_name = 'idx_assignment_user_assignment_id';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_assignment_user_assignment_id ON assignment_user(assignment_id, user_id)',
    'SELECT "Index idx_assignment_user_assignment_id already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. questions 테이블 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'questions' AND index_name = 'idx_questions_assignment_id';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_questions_assignment_id ON questions(assignment_id)',
    'SELECT "Index idx_questions_assignment_id already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. squares_info 테이블 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'squares_info' AND index_name = 'idx_squares_info_question_user';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_squares_info_question_user ON squares_info(question_id, user_id)',
    'SELECT "Index idx_squares_info_question_user already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. polygon_info 테이블 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'polygon_info' AND index_name = 'idx_polygon_info_question_user';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_polygon_info_question_user ON polygon_info(question_id, user_id)',
    'SELECT "Index idx_polygon_info_question_user already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. question_responses 테이블 인덱스
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'question_responses' AND index_name = 'idx_question_responses_question_option';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_question_responses_question_option ON question_responses(question_id, selected_option)',
    'SELECT "Index idx_question_responses_question_option already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. 복합 인덱스로 조인 성능 향상
SELECT COUNT(*) INTO @index_exists 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'questions' AND index_name = 'idx_questions_assignment_id_id';

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_questions_assignment_id_id ON questions(assignment_id, id)',
    'SELECT "Index idx_questions_assignment_id_id already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 완료 메시지
SELECT 'Database optimization indexes created successfully!' as message;