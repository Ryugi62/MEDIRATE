-- MEDIRATE DB 성능 최적화를 위한 인덱스 추가
-- 다음 쿼리들을 실행하여 데이터베이스 성능을 향상시키세요

-- 1. assignments 테이블 인덱스 (대시보드 필터링용)
CREATE INDEX IF NOT EXISTS idx_assignments_mode_cancer_folder 
ON assignments(assignment_mode, cancer_type, folder_name);

CREATE INDEX IF NOT EXISTS idx_assignments_creation_date 
ON assignments(creation_date DESC);

-- 2. canvas_info 테이블 인덱스 (대시보드 시간 정보용)
CREATE INDEX IF NOT EXISTS idx_canvas_info_assignment_id 
ON canvas_info(assignment_id);

CREATE INDEX IF NOT EXISTS idx_canvas_info_assignment_end_time 
ON canvas_info(assignment_id, end_time);

-- 3. assignment_user 테이블 인덱스 (평가자 수 집계용)
CREATE INDEX IF NOT EXISTS idx_assignment_user_assignment_id 
ON assignment_user(assignment_id, user_id);

-- 4. questions 테이블 인덱스 (문제 수 집계용)
CREATE INDEX IF NOT EXISTS idx_questions_assignment_id 
ON questions(assignment_id);

-- 5. squares_info 테이블 인덱스 (BBox 답변 집계용)
CREATE INDEX IF NOT EXISTS idx_squares_info_question_user 
ON squares_info(question_id, user_id);

-- 6. polygon_info 테이블 인덱스 (Polygon 답변 집계용)
CREATE INDEX IF NOT EXISTS idx_polygon_info_question_user 
ON polygon_info(question_id, user_id);

-- 7. question_responses 테이블 인덱스 (TextBox 답변 집계용)
CREATE INDEX IF NOT EXISTS idx_question_responses_question_option 
ON question_responses(question_id, selected_option);

-- 8. 복합 인덱스로 조인 성능 향상
CREATE INDEX IF NOT EXISTS idx_questions_assignment_id_id 
ON questions(assignment_id, id);

-- 인덱스 생성 완료 메시지
SELECT 'Database optimization indexes created successfully!' as message;