// consensusRoutes.js
// 합의(Consensus) 모드 관련 API 라우트

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

// 파일 업로드 설정
const uploadDir = path.join(__dirname, "../uploads/nipa");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const nipaUpload = multer({ dest: uploadDir });

const router = express.Router();

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send({ message, error: error.message });
};

// 자연 정렬 함수 (파일명의 숫자를 올바르게 정렬)
const naturalSort = (a, b) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// ========================================
// GET /api/consensus - 합의 과제 목록
// ========================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const showAll = req.query.all === "true"; // 대시보드에서 모든 과제 조회

    let query;
    let params;

    if (showAll) {
      // 대시보드: 모든 과제 조회 (할당 여부 무관)
      query = `
        SELECT
          ca.id,
          ca.title,
          ca.deadline,
          ca.source_excel,
          ca.evaluator_threshold,
          ca.score_threshold,
          ca.assignment_type,
          ca.creation_date,
          ca.project_id,
          ca.cancer_type_id,
          (SELECT COUNT(*) FROM consensus_fp_squares WHERE consensus_assignment_id = ca.id AND deleted_at IS NULL) AS total_fp,
          (SELECT COUNT(DISTINCT cr.fp_square_id)
           FROM consensus_responses cr
           JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
           WHERE cfp.consensus_assignment_id = ca.id AND cr.user_id = ? AND cr.deleted_at IS NULL AND cfp.deleted_at IS NULL) AS responded_fp,
          cci.evaluation_time,
          cci.start_time,
          cci.end_time,
          (SELECT COUNT(*) FROM consensus_user_assignments WHERE consensus_assignment_id = ca.id AND deleted_at IS NULL) AS evaluator_count
        FROM consensus_assignments ca
        LEFT JOIN consensus_canvas_info cci ON cci.consensus_assignment_id = ca.id AND cci.user_id = ? AND cci.deleted_at IS NULL
        WHERE ca.deleted_at IS NULL
        ORDER BY ca.creation_date DESC
      `;
      params = [userId, userId];
    } else {
      // 일반: 할당된 과제만 조회 (기간이 지나지 않은 과제만)
      query = `
        SELECT
          ca.id,
          ca.title,
          ca.deadline,
          ca.source_excel,
          ca.evaluator_threshold,
          ca.score_threshold,
          ca.assignment_type,
          ca.creation_date,
          ca.project_id,
          ca.cancer_type_id,
          (SELECT COUNT(*) FROM consensus_fp_squares WHERE consensus_assignment_id = ca.id AND deleted_at IS NULL) AS total_fp,
          (SELECT COUNT(DISTINCT cr.fp_square_id)
           FROM consensus_responses cr
           JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
           WHERE cfp.consensus_assignment_id = ca.id AND cr.user_id = ? AND cr.deleted_at IS NULL AND cfp.deleted_at IS NULL) AS responded_fp,
          cci.evaluation_time,
          cci.start_time,
          cci.end_time
        FROM consensus_assignments ca
        JOIN consensus_user_assignments cua ON ca.id = cua.consensus_assignment_id AND cua.deleted_at IS NULL
        LEFT JOIN consensus_canvas_info cci ON cci.consensus_assignment_id = ca.id AND cci.user_id = ? AND cci.deleted_at IS NULL
        WHERE cua.user_id = ? AND ca.deleted_at IS NULL AND ca.deadline >= CURRENT_DATE
        ORDER BY ca.creation_date DESC
      `;
      params = [userId, userId, userId];
    }

    const [assignments] = await db.query(query, params);

    // 배치 쿼리: 모든 과제의 태그를 한 번에 조회
    if (assignments.length > 0) {
      const assignmentIds = assignments.map(a => a.id);
      const placeholders = assignmentIds.map(() => '?').join(',');
      const [allTags] = await db.query(
        `SELECT cat.consensus_assignment_id, t.id, t.name, t.color
         FROM tags t
         JOIN consensus_assignment_tags cat ON t.id = cat.tag_id
         WHERE cat.consensus_assignment_id IN (${placeholders}) AND t.deleted_at IS NULL`,
        assignmentIds
      );

      // 태그를 과제 ID별로 그룹화
      const tagsByAssignmentId = {};
      allTags.forEach(tag => {
        if (!tagsByAssignmentId[tag.consensus_assignment_id]) {
          tagsByAssignmentId[tag.consensus_assignment_id] = [];
        }
        tagsByAssignmentId[tag.consensus_assignment_id].push({
          id: tag.id,
          name: tag.name,
          color: tag.color
        });
      });

      // 각 과제에 태그 매핑
      for (const assignment of assignments) {
        assignment.tags = tagsByAssignmentId[assignment.id] || [];
      }
    }

    res.json(assignments);
  } catch (error) {
    handleError(res, "합의 과제 목록을 가져오는 중 오류 발생", error);
  }
});

// ========================================
// GET /api/consensus/:id - 합의 과제 상세
// ========================================
router.get("/:consensusId", authenticateToken, async (req, res) => {
  try {
    const { consensusId } = req.params;
    const userId = req.user.id;

    // 1. 과제 정보 조회 (할당 여부 무관하게 조회, 프로젝트/암종 정보 포함)
    const [assignmentResult] = await db.query(
      `SELECT ca.*, p.name AS projectName, ct.name_ko AS cancerTypeName
       FROM consensus_assignments ca
       LEFT JOIN projects p ON ca.project_id = p.id AND p.deleted_at IS NULL
       LEFT JOIN cancer_types ct ON ca.cancer_type_id = ct.id AND ct.deleted_at IS NULL
       WHERE ca.id = ? AND ca.deleted_at IS NULL`,
      [consensusId]
    );

    if (assignmentResult.length === 0) {
      return res.status(404).json({ message: "합의 과제를 찾을 수 없습니다." });
    }

    const assignment = assignmentResult[0];

    // 2. 할당된 평가자 목록 조회
    const [evaluators] = await db.query(
      `SELECT u.id, u.username, u.realname, u.organization
       FROM consensus_user_assignments cua
       JOIN users u ON cua.user_id = u.id AND u.deleted_at IS NULL
       WHERE cua.consensus_assignment_id = ? AND cua.deleted_at IS NULL`,
      [consensusId]
    );

    // 3. FP 사각형 조회 (이미지별로 그룹화) + 동의 수 집계
    const [fpSquares] = await db.query(
      `SELECT cfp.id, cfp.question_image, cfp.x, cfp.y, cfp.ai_score,
              (SELECT COUNT(*) FROM consensus_responses cr
               WHERE cr.fp_square_id = cfp.id AND cr.response = 'agree' AND cr.deleted_at IS NULL) as agree_count,
              (SELECT COUNT(*) FROM consensus_responses cr
               WHERE cr.fp_square_id = cfp.id AND cr.response = 'disagree' AND cr.deleted_at IS NULL) as disagree_count
       FROM consensus_fp_squares cfp
       WHERE cfp.consensus_assignment_id = ? AND cfp.deleted_at IS NULL
       ORDER BY cfp.question_image, cfp.id`,
      [consensusId]
    );

    // 4. 사용자의 응답 조회
    const [responses] = await db.query(
      `SELECT cr.fp_square_id, cr.response
       FROM consensus_responses cr
       JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
       WHERE cfp.consensus_assignment_id = ? AND cr.user_id = ? AND cr.deleted_at IS NULL AND cfp.deleted_at IS NULL`,
      [consensusId, userId]
    );

    // 응답을 맵으로 변환
    const responseMap = {};
    responses.forEach((r) => {
      responseMap[r.fp_square_id] = r.response;
    });

    // 4-1. 모든 평가자의 개별 응답 조회 (개별 결과 표시용)
    const [allResponses] = await db.query(
      `SELECT cr.fp_square_id, cr.user_id, cr.response, u.realname, u.username
       FROM consensus_responses cr
       JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
       JOIN users u ON cr.user_id = u.id AND u.deleted_at IS NULL
       WHERE cfp.consensus_assignment_id = ? AND cr.deleted_at IS NULL AND cfp.deleted_at IS NULL`,
      [consensusId]
    );

    // 각 FP별 평가자 응답 맵 생성
    const evaluatorResponsesMap = {};
    allResponses.forEach((r) => {
      if (!evaluatorResponsesMap[r.fp_square_id]) {
        evaluatorResponsesMap[r.fp_square_id] = {};
      }
      evaluatorResponsesMap[r.fp_square_id][r.user_id] = {
        response: r.response,
        realname: r.realname,
        username: r.username,
      };
    });

    // 5. 캔버스 정보 조회
    const [canvasResult] = await db.query(
      `SELECT id, width, height, last_question_image, evaluation_time, start_time, end_time
       FROM consensus_canvas_info
       WHERE consensus_assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
      [consensusId, userId]
    );

    const canvasInfo = canvasResult[0] || {
      width: 0,
      height: 0,
      last_question_image: null,
      evaluation_time: 0,
      start_time: null,
      end_time: null,
    };

    // 6. 이미지 목록 생성 (중복 제거 + 자연 정렬)
    const imageSet = new Set(fpSquares.map((fp) => fp.question_image));
    const sortedImageList = Array.from(imageSet).sort(naturalSort);
    const images = sortedImageList.map((img) => {
      const imageFpSquares = fpSquares.filter((fp) => fp.question_image === img);
      const respondedCount = imageFpSquares.filter(
        (fp) => responseMap[fp.id]
      ).length;
      return {
        image: img,
        fpCount: imageFpSquares.length,
        respondedCount,
        isCompleted: respondedCount === imageFpSquares.length,
      };
    });

    // 7. 각 FP에 골드 스탠다드 여부 추가 (2/3 이상 동의)
    const evaluatorCount = evaluators.length;
    const threshold = Math.ceil(evaluatorCount * 2 / 3); // 2/3 이상

    const fpSquaresWithGS = fpSquares.map((fp) => ({
      ...fp,
      total_responses: fp.agree_count + fp.disagree_count,
      is_gold_standard: fp.agree_count >= threshold,
    }));

    // 8. NIPA 데이터 조회 (이미지 파일명으로 직접 매핑)
    let nipaData = {};
    const imageList = sortedImageList;
    if (imageList.length > 0) {
      const placeholders = imageList.map(() => '?').join(',');
      const [nipaResult] = await db.query(
        `SELECT question_image, match_2, match_3, match_2 as gs_nipa, boxes_json
         FROM nipa_match_data
         WHERE question_image IN (${placeholders}) AND deleted_at IS NULL`,
        imageList
      );

      // NIPA 데이터를 맵으로 변환
      nipaResult.forEach((n) => {
        // boxes_json 파싱
        let boxes = { match_2: [], match_3: [] };
        if (n.boxes_json) {
          try {
            boxes = JSON.parse(n.boxes_json);
          } catch (e) {
            // 파싱 실패 시 기본값 유지
          }
        }

        nipaData[n.question_image] = {
          match_2: n.match_2,
          match_3: n.match_3,
          gs_nipa: n.gs_nipa,
          boxes: boxes,
        };
      });
    }

    res.json({
      ...assignment,
      evaluators,
      evaluatorCount,
      threshold,
      images,
      fpSquares: fpSquaresWithGS,
      responses: responseMap,
      evaluatorResponses: evaluatorResponsesMap,
      canvasInfo,
      nipaData,
    });
  } catch (error) {
    handleError(res, "합의 과제 상세를 가져오는 중 오류 발생", error);
  }
});

// ========================================
// POST /api/consensus/import - FP 데이터 임포트
// ========================================
router.post("/import", authenticateToken, async (req, res) => {
  const { title, deadline, users, fp_data, assignment_type } = req.body;

  if (!title || !deadline || !users || !fp_data) {
    return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
  }

  try {
    // Convert ISO 8601 datetime to MySQL DATE format (YYYY-MM-DD)
    const formattedDeadline = deadline ? new Date(deadline).toISOString().split('T')[0] : null;

    await db.withTransaction(async (conn) => {
      // 1. consensus_assignments 생성
      const [assignmentResult] = await conn.query(
        `INSERT INTO consensus_assignments (title, deadline, source_excel, evaluator_threshold, score_threshold, assignment_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          title,
          formattedDeadline,
          fp_data.source_excel || null,
          fp_data.evaluator_threshold || 3,
          fp_data.score_threshold || 0.5,
          assignment_type || fp_data.assignment_type || null,
        ]
      );

      const consensusAssignmentId = assignmentResult.insertId;

      // 2. consensus_user_assignments 생성
      for (const userId of users) {
        await conn.query(
          `INSERT INTO consensus_user_assignments (consensus_assignment_id, user_id)
           VALUES (?, ?)`,
          [consensusAssignmentId, userId]
        );
      }

      // 3. consensus_fp_squares 생성
      if (fp_data.assignments) {
        for (const assignment of fp_data.assignments) {
          const assignmentTypeFromData = assignment.assignment_type;

          for (const question of assignment.questions || []) {
            for (const fpSquare of question.fp_squares || []) {
              // 좌표 유효성 검증 (음수 또는 비정상적으로 큰 값 체크)
              const x = Math.max(0, Number(fpSquare.x) || 0);
              const y = Math.max(0, Number(fpSquare.y) || 0);

              await conn.query(
                `INSERT INTO consensus_fp_squares (consensus_assignment_id, question_image, x, y, ai_score)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  consensusAssignmentId,
                  question.image,
                  x,
                  y,
                  fpSquare.score,
                ]
              );
            }
          }
        }
      }

      // 4. consensus_canvas_info 생성 (각 사용자별)
      for (const userId of users) {
        await conn.query(
          `INSERT INTO consensus_canvas_info (consensus_assignment_id, user_id, width, height, evaluation_time)
           VALUES (?, ?, 0, 0, 0)`,
          [consensusAssignmentId, userId]
        );
      }

      res.status(201).json({
        message: "합의 과제가 성공적으로 생성되었습니다.",
        consensusAssignmentId,
      });
    });
  } catch (error) {
    handleError(res, "합의 과제 생성 중 오류 발생", error);
  }
});

// ========================================
// PUT /api/consensus/:id/response - 응답 저장
// ========================================
router.put("/:consensusId/response", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;
  const { responses, question_image, canvas_info } = req.body;
  const userId = req.user.id;

  try {
    await db.withTransaction(async (conn) => {
      // 1. 응답 저장 (UPSERT)
      for (const [fpSquareId, response] of Object.entries(responses || {})) {
        await conn.query(
          `INSERT INTO consensus_responses (fp_square_id, user_id, response)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE response = ?, responded_at = CURRENT_TIMESTAMP`,
          [fpSquareId, userId, response, response]
        );
      }

      // 2. 캔버스 정보 업데이트
      if (canvas_info) {
        await conn.query(
          `UPDATE consensus_canvas_info
           SET width = ?, height = ?, last_question_image = ?, evaluation_time = ?,
               start_time = IF(start_time IS NULL, CONVERT_TZ(NOW(), 'UTC', 'Asia/Seoul'), start_time),
               end_time = CONVERT_TZ(NOW(), 'UTC', 'Asia/Seoul')
           WHERE consensus_assignment_id = ? AND user_id = ?`,
          [
            canvas_info.width || 0,
            canvas_info.height || 0,
            question_image || null,
            canvas_info.evaluation_time || 0,
            consensusId,
            userId,
          ]
        );
      }

      res.json({ message: "응답이 저장되었습니다." });
    });
  } catch (error) {
    handleError(res, "응답 저장 중 오류 발생", error);
  }
});

// ========================================
// PUT /api/consensus/:id/bulk-response - 일괄 응답 (Space/Shift+Space)
// ========================================
router.put("/:consensusId/bulk-response", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;
  const { question_image, response } = req.body;
  const userId = req.user.id;

  if (!question_image || !response) {
    return res.status(400).json({ message: "필수 필드가 누락되었습니다." });
  }

  try {
    // 해당 이미지의 모든 FP 사각형 조회
    const [fpSquares] = await db.query(
      `SELECT id FROM consensus_fp_squares
       WHERE consensus_assignment_id = ? AND question_image = ? AND deleted_at IS NULL`,
      [consensusId, question_image]
    );

    await db.withTransaction(async (conn) => {
      for (const fp of fpSquares) {
        await conn.query(
          `INSERT INTO consensus_responses (fp_square_id, user_id, response)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE response = ?, responded_at = CURRENT_TIMESTAMP`,
          [fp.id, userId, response, response]
        );
      }
    });

    res.json({
      message: `${fpSquares.length}개의 FP에 '${response}' 응답이 적용되었습니다.`,
    });
  } catch (error) {
    handleError(res, "일괄 응답 저장 중 오류 발생", error);
  }
});

// ========================================
// PUT /api/consensus/:id/canvas - 캔버스 정보 업데이트
// ========================================
router.put("/:consensusId/canvas", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;
  const { width, height, last_question_image, evaluation_time } = req.body;
  const userId = req.user.id;

  try {
    await db.query(
      `UPDATE consensus_canvas_info
       SET width = ?, height = ?, last_question_image = ?, evaluation_time = ?,
           start_time = IF(start_time IS NULL, CONVERT_TZ(NOW(), 'UTC', 'Asia/Seoul'), start_time),
           end_time = CONVERT_TZ(NOW(), 'UTC', 'Asia/Seoul')
       WHERE consensus_assignment_id = ? AND user_id = ?`,
      [width || 0, height || 0, last_question_image, evaluation_time || 0, consensusId, userId]
    );

    res.json({ message: "캔버스 정보가 업데이트되었습니다." });
  } catch (error) {
    handleError(res, "캔버스 정보 업데이트 중 오류 발생", error);
  }
});

// ========================================
// GET /api/consensus/:id/metrics - Metrics 조회
// ========================================
router.get("/:consensusId/metrics", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;

  try {
    // 1. 평가자 수 조회
    const [evaluatorsResult] = await db.query(
      `SELECT COUNT(*) as count FROM consensus_user_assignments
       WHERE consensus_assignment_id = ? AND deleted_at IS NULL`,
      [consensusId]
    );
    const evaluatorCount = evaluatorsResult[0].count;

    // 2. FP 사각형 및 응답 통계 조회
    const [fpStats] = await db.query(
      `SELECT
         cfp.id,
         cfp.ai_score,
         (SELECT COUNT(*) FROM consensus_responses cr
          WHERE cr.fp_square_id = cfp.id AND cr.response = 'agree' AND cr.deleted_at IS NULL) as agree_count,
         (SELECT COUNT(*) FROM consensus_responses cr
          WHERE cr.fp_square_id = cfp.id AND cr.response = 'disagree' AND cr.deleted_at IS NULL) as disagree_count
       FROM consensus_fp_squares cfp
       WHERE cfp.consensus_assignment_id = ? AND cfp.deleted_at IS NULL`,
      [consensusId]
    );

    const totalFP = fpStats.length;
    if (totalFP === 0) {
      return res.json({
        totalFP: 0,
        consensusRate: 0,
        goldStandardRate: 0,
        averageAgreeCount: 0,
        confirmedFP: 0,
        changedToTP: 0,
        undecided: 0,
        evaluatorStats: [],
      });
    }

    // Gold Standard 임계값 (2/3 이상 동의)
    const gsThreshold = Math.ceil(evaluatorCount * 2 / 3);

    // 통계 계산
    let consensusCount = 0; // 동의 > 비동의인 FP
    let goldStandardCount = 0; // 2/3 이상 동의
    let totalAgree = 0;
    let confirmedFP = 0; // 동의 > 비동의
    let changedToTP = 0; // 비동의 > 동의
    let undecided = 0; // 동점

    fpStats.forEach((fp) => {
      totalAgree += fp.agree_count;

      if (fp.agree_count > fp.disagree_count) {
        consensusCount++;
        confirmedFP++;
      } else if (fp.disagree_count > fp.agree_count) {
        changedToTP++;
      } else {
        undecided++;
      }

      if (fp.agree_count >= gsThreshold) {
        goldStandardCount++;
      }
    });

    // 3. 평가자별 통계
    const [evaluatorStats] = await db.query(
      `SELECT
         u.id,
         u.realname,
         u.username,
         COUNT(CASE WHEN cr.response = 'agree' THEN 1 END) as agree_count,
         COUNT(CASE WHEN cr.response = 'disagree' THEN 1 END) as disagree_count,
         COUNT(cr.id) as total_responses
       FROM consensus_user_assignments cua
       JOIN users u ON cua.user_id = u.id AND u.deleted_at IS NULL
       LEFT JOIN consensus_responses cr ON cr.user_id = u.id AND cr.deleted_at IS NULL
       LEFT JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
         AND cfp.consensus_assignment_id = ? AND cfp.deleted_at IS NULL
       WHERE cua.consensus_assignment_id = ? AND cua.deleted_at IS NULL
       GROUP BY u.id, u.realname, u.username`,
      [consensusId, consensusId]
    );

    // 평가자별 동의율 계산
    const evaluatorStatsWithRate = evaluatorStats.map((e) => ({
      ...e,
      agreeRate: e.total_responses > 0
        ? Math.round((e.agree_count / e.total_responses) * 100)
        : 0,
      completionRate: totalFP > 0
        ? Math.round((e.total_responses / totalFP) * 100)
        : 0,
    }));

    res.json({
      totalFP,
      evaluatorCount,
      gsThreshold,
      consensusRate: Math.round((consensusCount / totalFP) * 100), // 합의율 (%)
      goldStandardRate: Math.round((goldStandardCount / totalFP) * 100), // GS 비율 (%)
      averageAgreeCount: (totalAgree / totalFP).toFixed(2), // 평균 동의 수
      confirmedFP, // FP 확정 (동의 > 비동의)
      changedToTP, // TP로 변경 (비동의 > 동의)
      undecided, // 미결정 (동점)
      evaluatorStats: evaluatorStatsWithRate,
    });
  } catch (error) {
    handleError(res, "Metrics 조회 중 오류 발생", error);
  }
});

// ========================================
// GET /api/consensus/:id/export - 결과 엑셀 내보내기
// ========================================
router.get("/:consensusId/export", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;

  try {
    // 1. 과제 정보
    const [assignment] = await db.query(
      `SELECT * FROM consensus_assignments WHERE id = ? AND deleted_at IS NULL`,
      [consensusId]
    );

    if (assignment.length === 0) {
      return res.status(404).json({ message: "합의 과제를 찾을 수 없습니다." });
    }

    // 2. 할당된 사용자 목록
    const [users] = await db.query(
      `SELECT u.id, u.username, u.realname
       FROM consensus_user_assignments cua
       JOIN users u ON cua.user_id = u.id AND u.deleted_at IS NULL
       WHERE cua.consensus_assignment_id = ? AND cua.deleted_at IS NULL`,
      [consensusId]
    );

    // 3. FP 사각형 + 응답
    const [fpSquares] = await db.query(
      `SELECT cfp.id, cfp.question_image, cfp.x, cfp.y, cfp.ai_score
       FROM consensus_fp_squares cfp
       WHERE cfp.consensus_assignment_id = ? AND cfp.deleted_at IS NULL
       ORDER BY cfp.question_image, cfp.id`,
      [consensusId]
    );

    // 4. 모든 응답
    const [allResponses] = await db.query(
      `SELECT cr.fp_square_id, cr.user_id, cr.response
       FROM consensus_responses cr
       JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
       WHERE cfp.consensus_assignment_id = ? AND cr.deleted_at IS NULL AND cfp.deleted_at IS NULL`,
      [consensusId]
    );

    // 5. 캔버스 정보 (타이밍)
    const [canvasInfos] = await db.query(
      `SELECT cci.user_id, cci.evaluation_time, cci.start_time, cci.end_time
       FROM consensus_canvas_info cci
       WHERE cci.consensus_assignment_id = ? AND cci.deleted_at IS NULL`,
      [consensusId]
    );

    // 응답 맵 생성: {fpSquareId: {userId: response}}
    const responseMap = {};
    allResponses.forEach((r) => {
      if (!responseMap[r.fp_square_id]) {
        responseMap[r.fp_square_id] = {};
      }
      responseMap[r.fp_square_id][r.user_id] = r.response;
    });

    // 결과 데이터 생성
    const resultData = fpSquares.map((fp) => {
      const row = {
        과제ID: consensusId,
        이미지: fp.question_image,
        FP_ID: fp.id,
        X: fp.x,
        Y: fp.y,
        AI_Score: fp.ai_score,
      };

      let agreeCount = 0;
      let disagreeCount = 0;

      users.forEach((user) => {
        const response = responseMap[fp.id]?.[user.id] || "";
        row[user.realname] = response;
        if (response === "agree") agreeCount++;
        if (response === "disagree") disagreeCount++;
      });

      row["동의"] = agreeCount;
      row["비동의"] = disagreeCount;
      row["최종결과"] =
        agreeCount > disagreeCount
          ? "Confirmed FP"
          : disagreeCount > agreeCount
          ? "Changed to TP"
          : "Undecided";

      return row;
    });

    // 시간 데이터 생성
    const timeData = users.map((user) => {
      const canvas = canvasInfos.find((c) => c.user_id === user.id);
      return {
        과제ID: consensusId,
        평가자이름: user.realname,
        시작시간: canvas?.start_time || "",
        종료시간: canvas?.end_time || "",
        소요시간: canvas?.evaluation_time
          ? formatTime(canvas.evaluation_time)
          : "",
      };
    });

    // 통계 데이터 생성
    const totalFP = fpSquares.length;
    const gsThreshold = Math.ceil(users.length * 2 / 3);
    let confirmedFP = 0;
    let changedToTP = 0;
    let undecided = 0;
    let goldStandardCount = 0;
    let totalAgree = 0;

    resultData.forEach((row) => {
      const agreeCount = row["동의"];
      const disagreeCount = row["비동의"];
      totalAgree += agreeCount;

      if (agreeCount > disagreeCount) {
        confirmedFP++;
      } else if (disagreeCount > agreeCount) {
        changedToTP++;
      } else {
        undecided++;
      }

      if (agreeCount >= gsThreshold) {
        goldStandardCount++;
      }
    });

    const statisticsData = {
      과제ID: consensusId,
      과제명: assignment[0].title,
      총_FP: totalFP,
      평가자수: users.length,
      GS_임계값: gsThreshold,
      합의율: totalFP > 0 ? Math.round((confirmedFP / totalFP) * 100) : 0,
      GS_비율: totalFP > 0 ? Math.round((goldStandardCount / totalFP) * 100) : 0,
      평균_동의수: totalFP > 0 ? (totalAgree / totalFP).toFixed(2) : 0,
      FP_확정: confirmedFP,
      TP_변경: changedToTP,
      미결정: undecided,
    };

    res.json({
      assignment: assignment[0],
      users,
      resultData,
      timeData,
      statisticsData,
    });
  } catch (error) {
    handleError(res, "내보내기 데이터 생성 중 오류 발생", error);
  }
});

// 시간 포맷 헬퍼 함수
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// ========================================
// PUT /api/consensus/bulk-assign - 선택한 과제에 일괄 할당
// NOTE: 이 라우트는 /:consensusId 보다 먼저 정의되어야 함
// ========================================
router.put("/bulk-assign", authenticateToken, async (req, res) => {
  const { assignment_ids, user_ids } = req.body;

  if (!assignment_ids || assignment_ids.length === 0) {
    return res.status(400).json({ message: "과제를 선택해주세요." });
  }

  if (!user_ids || user_ids.length === 0) {
    return res.status(400).json({ message: "평가자를 선택해주세요." });
  }

  // 입력값 검증: 정수 배열인지 확인
  if (!Array.isArray(assignment_ids) || !assignment_ids.every(id => Number.isInteger(id))) {
    return res.status(400).json({ message: "잘못된 과제 ID 형식입니다." });
  }

  if (!Array.isArray(user_ids) || !user_ids.every(id => Number.isInteger(id))) {
    return res.status(400).json({ message: "잘못된 사용자 ID 형식입니다." });
  }

  try {
    // 과제 존재 여부 확인
    const [existingAssignments] = await db.query(
      `SELECT id FROM consensus_assignments WHERE id IN (?) AND deleted_at IS NULL`,
      [assignment_ids]
    );
    const existingAssignmentIds = new Set(existingAssignments.map(a => a.id));
    const invalidAssignmentIds = assignment_ids.filter(id => !existingAssignmentIds.has(id));

    if (invalidAssignmentIds.length > 0) {
      return res.status(404).json({
        message: "존재하지 않는 과제가 포함되어 있습니다.",
        invalidIds: invalidAssignmentIds
      });
    }

    // 사용자 존재 여부 확인
    const [existingUsers] = await db.query(
      `SELECT id FROM users WHERE id IN (?) AND deleted_at IS NULL`,
      [user_ids]
    );
    const existingUserIds = new Set(existingUsers.map(u => u.id));
    const invalidUserIds = user_ids.filter(id => !existingUserIds.has(id));

    if (invalidUserIds.length > 0) {
      return res.status(404).json({
        message: "존재하지 않는 사용자가 포함되어 있습니다.",
        invalidIds: invalidUserIds
      });
    }

    await db.withTransaction(async (conn) => {
      for (const assignmentId of assignment_ids) {
        // 기존 할당 soft delete
        await conn.query(
          `UPDATE consensus_user_assignments SET deleted_at = NOW()
           WHERE consensus_assignment_id = ? AND deleted_at IS NULL`,
          [assignmentId]
        );

        // 기존 캔버스 정보 soft delete
        await conn.query(
          `UPDATE consensus_canvas_info SET deleted_at = NOW()
           WHERE consensus_assignment_id = ? AND deleted_at IS NULL`,
          [assignmentId]
        );

        // 새 사용자 할당
        for (const userId of user_ids) {
          // consensus_user_assignments에 추가
          await conn.query(
            `INSERT INTO consensus_user_assignments (consensus_assignment_id, user_id, deleted_at)
             VALUES (?, ?, NULL)
             ON DUPLICATE KEY UPDATE deleted_at = NULL`,
            [assignmentId, userId]
          );

          // consensus_canvas_info 생성 (없는 경우)
          const [existingCanvas] = await conn.query(
            `SELECT id FROM consensus_canvas_info
             WHERE consensus_assignment_id = ? AND user_id = ?`,
            [assignmentId, userId]
          );

          if (existingCanvas.length === 0) {
            await conn.query(
              `INSERT INTO consensus_canvas_info (consensus_assignment_id, user_id, width, height, evaluation_time)
               VALUES (?, ?, 0, 0, 0)`,
              [assignmentId, userId]
            );
          } else {
            // 기존 캔버스 복원
            await conn.query(
              `UPDATE consensus_canvas_info SET deleted_at = NULL
               WHERE consensus_assignment_id = ? AND user_id = ?`,
              [assignmentId, userId]
            );
          }
        }
      }
    });

    res.json({
      message: `${assignment_ids.length}개 과제에 ${user_ids.length}명의 평가자가 할당되었습니다.`,
    });
  } catch (error) {
    handleError(res, "일괄 할당 중 오류 발생", error);
  }
});

// ========================================
// PUT /api/consensus/:id - 과제 수정
// ========================================
router.put("/:consensusId", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;
  const { title, deadline, evaluator_threshold, score_threshold, project_id, cancer_type_id, users } = req.body;

  try {
    // 관리자 권한 확인
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "관리자만 수정할 수 있습니다." });
    }

    // 과제 존재 확인
    const [assignment] = await db.query(
      `SELECT * FROM consensus_assignments WHERE id = ? AND deleted_at IS NULL`,
      [consensusId]
    );

    if (assignment.length === 0) {
      return res.status(404).json({ message: "합의 과제를 찾을 수 없습니다." });
    }

    // Convert ISO 8601 datetime to MySQL DATE format (YYYY-MM-DD)
    const formattedDeadline = deadline ? new Date(deadline).toISOString().split('T')[0] : null;

    await db.withTransaction(async (conn) => {
      // 과제 정보 업데이트
      await conn.query(
        `UPDATE consensus_assignments
         SET title = ?, deadline = ?, evaluator_threshold = ?, score_threshold = ?,
             project_id = ?, cancer_type_id = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [title, formattedDeadline, evaluator_threshold, score_threshold, project_id, cancer_type_id, consensusId]
      );

      // users가 제공된 경우 평가자 업데이트
      if (Array.isArray(users)) {
        // 기존 할당된 사용자 조회
        const [existingUsers] = await conn.query(
          `SELECT user_id FROM consensus_user_assignments
           WHERE consensus_assignment_id = ? AND deleted_at IS NULL`,
          [consensusId]
        );
        const existingUserIds = new Set(existingUsers.map(u => u.user_id));
        const newUserIds = new Set(users);

        // 제거할 사용자 (기존에 있었지만 새 목록에 없는)
        const usersToRemove = [...existingUserIds].filter(id => !newUserIds.has(id));
        // 추가할 사용자 (새 목록에 있지만 기존에 없는)
        const usersToAdd = users.filter(id => !existingUserIds.has(id));

        // 사용자 제거 (soft delete)
        for (const userId of usersToRemove) {
          await conn.query(
            `UPDATE consensus_user_assignments SET deleted_at = NOW()
             WHERE consensus_assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [consensusId, userId]
          );
          await conn.query(
            `UPDATE consensus_canvas_info SET deleted_at = NOW()
             WHERE consensus_assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [consensusId, userId]
          );
        }

        // 사용자 추가 또는 복원
        for (const userId of usersToAdd) {
          // 기존 레코드가 있으면 복원, 없으면 생성
          await conn.query(
            `INSERT INTO consensus_user_assignments (consensus_assignment_id, user_id, deleted_at)
             VALUES (?, ?, NULL)
             ON DUPLICATE KEY UPDATE deleted_at = NULL`,
            [consensusId, userId]
          );

          // 캔버스 정보 생성 또는 복원
          const [existingCanvas] = await conn.query(
            `SELECT id FROM consensus_canvas_info
             WHERE consensus_assignment_id = ? AND user_id = ?`,
            [consensusId, userId]
          );

          if (existingCanvas.length === 0) {
            await conn.query(
              `INSERT INTO consensus_canvas_info (consensus_assignment_id, user_id, width, height, evaluation_time)
               VALUES (?, ?, 0, 0, 0)`,
              [consensusId, userId]
            );
          } else {
            await conn.query(
              `UPDATE consensus_canvas_info SET deleted_at = NULL
               WHERE consensus_assignment_id = ? AND user_id = ?`,
              [consensusId, userId]
            );
          }
        }
      }
    });

    res.json({ message: "수정되었습니다." });
  } catch (error) {
    handleError(res, "합의 과제 수정 중 오류 발생", error);
  }
});

// ========================================
// DELETE /api/consensus/:id - 과제 삭제 (Soft Delete)
// ========================================
router.delete("/:consensusId", authenticateToken, async (req, res) => {
  const { consensusId } = req.params;

  try {
    // 관리자 권한 확인 (선택적)
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "관리자만 삭제할 수 있습니다." });
    }

    const [assignment] = await db.query(
      `SELECT * FROM consensus_assignments WHERE id = ? AND deleted_at IS NULL`,
      [consensusId]
    );

    if (assignment.length === 0) {
      return res.status(404).json({ message: "합의 과제를 찾을 수 없습니다." });
    }

    await db.withTransaction(async (conn) => {
      // Soft delete: consensus_responses
      await conn.query(
        `UPDATE consensus_responses cr
         JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
         SET cr.deleted_at = NOW()
         WHERE cfp.consensus_assignment_id = ?`,
        [consensusId]
      );

      // Soft delete: consensus_fp_squares
      await conn.query(
        `UPDATE consensus_fp_squares SET deleted_at = NOW() WHERE consensus_assignment_id = ?`,
        [consensusId]
      );

      // Soft delete: consensus_canvas_info
      await conn.query(
        `UPDATE consensus_canvas_info SET deleted_at = NOW() WHERE consensus_assignment_id = ?`,
        [consensusId]
      );

      // Soft delete: consensus_user_assignments
      await conn.query(
        `UPDATE consensus_user_assignments SET deleted_at = NOW() WHERE consensus_assignment_id = ?`,
        [consensusId]
      );

      // Soft delete: consensus_assignments
      await conn.query(
        `UPDATE consensus_assignments SET deleted_at = NOW() WHERE id = ?`,
        [consensusId]
      );
    });

    res.json({ message: "합의 과제가 삭제되었습니다." });
  } catch (error) {
    handleError(res, "합의 과제 삭제 중 오류 발생", error);
  }
});

// ========================================
// GET /api/consensus/:id/images/:image - 특정 이미지의 FP 정보
// ========================================
router.get("/:consensusId/images/:imageName", authenticateToken, async (req, res) => {
  const { consensusId, imageName } = req.params;
  const userId = req.user.id;

  try {
    const decodedImageName = decodeURIComponent(imageName);

    // FP 사각형 조회
    const [fpSquares] = await db.query(
      `SELECT id, x, y, ai_score
       FROM consensus_fp_squares
       WHERE consensus_assignment_id = ? AND question_image = ? AND deleted_at IS NULL`,
      [consensusId, decodedImageName]
    );

    // 응답 조회
    const [responses] = await db.query(
      `SELECT cr.fp_square_id, cr.response
       FROM consensus_responses cr
       JOIN consensus_fp_squares cfp ON cr.fp_square_id = cfp.id
       WHERE cfp.consensus_assignment_id = ? AND cfp.question_image = ? AND cr.user_id = ?
         AND cr.deleted_at IS NULL AND cfp.deleted_at IS NULL`,
      [consensusId, decodedImageName, userId]
    );

    const responseMap = {};
    responses.forEach((r) => {
      responseMap[r.fp_square_id] = r.response;
    });

    res.json({
      image: decodedImageName,
      fpSquares,
      responses: responseMap,
    });
  } catch (error) {
    handleError(res, "이미지 FP 정보 조회 중 오류 발생", error);
  }
});

// ========================================
// 평가자 그룹 관리 API
// ========================================

// GET /api/consensus/groups - 평가자 그룹 목록
router.get("/groups/list", authenticateToken, async (req, res) => {
  try {
    const [groups] = await db.query(
      `SELECT eg.id, eg.name, eg.description, eg.created_by, eg.creation_date,
              u.realname as creator_name,
              (SELECT COUNT(*) FROM evaluator_group_members egm
               WHERE egm.group_id = eg.id AND egm.deleted_at IS NULL) as member_count
       FROM evaluator_groups eg
       LEFT JOIN users u ON eg.created_by = u.id
       WHERE eg.deleted_at IS NULL
       ORDER BY eg.creation_date DESC`
    );

    // 각 그룹의 멤버 정보도 함께 조회
    for (const group of groups) {
      const [members] = await db.query(
        `SELECT u.id, u.username, u.realname, u.organization
         FROM evaluator_group_members egm
         JOIN users u ON egm.user_id = u.id AND u.deleted_at IS NULL
         WHERE egm.group_id = ? AND egm.deleted_at IS NULL`,
        [group.id]
      );
      group.members = members;
    }

    res.json(groups);
  } catch (error) {
    handleError(res, "평가자 그룹 목록 조회 중 오류 발생", error);
  }
});

// POST /api/consensus/groups - 그룹 생성
router.post("/groups", authenticateToken, async (req, res) => {
  const { name, description, member_ids } = req.body;
  const createdBy = req.user.id;

  if (!name) {
    return res.status(400).json({ message: "그룹 이름은 필수입니다." });
  }

  try {
    await db.withTransaction(async (conn) => {
      // 그룹 생성
      const [result] = await conn.query(
        `INSERT INTO evaluator_groups (name, description, created_by)
         VALUES (?, ?, ?)`,
        [name, description || null, createdBy]
      );

      const groupId = result.insertId;

      // 멤버 추가
      if (member_ids && member_ids.length > 0) {
        for (const userId of member_ids) {
          await conn.query(
            `INSERT INTO evaluator_group_members (group_id, user_id)
             VALUES (?, ?)`,
            [groupId, userId]
          );
        }
      }

      res.status(201).json({
        message: "평가자 그룹이 생성되었습니다.",
        groupId,
      });
    });
  } catch (error) {
    handleError(res, "평가자 그룹 생성 중 오류 발생", error);
  }
});

// PUT /api/consensus/groups/:id - 그룹 수정
router.put("/groups/:groupId", authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { name, description, member_ids } = req.body;

  if (!name) {
    return res.status(400).json({ message: "그룹 이름은 필수입니다." });
  }

  try {
    await db.withTransaction(async (conn) => {
      // 그룹 정보 업데이트
      await conn.query(
        `UPDATE evaluator_groups SET name = ?, description = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [name, description || null, groupId]
      );

      // 기존 멤버 soft delete
      await conn.query(
        `UPDATE evaluator_group_members SET deleted_at = NOW()
         WHERE group_id = ? AND deleted_at IS NULL`,
        [groupId]
      );

      // 새 멤버 추가
      if (member_ids && member_ids.length > 0) {
        for (const userId of member_ids) {
          // 이미 존재하는 경우 복원, 없으면 새로 추가
          await conn.query(
            `INSERT INTO evaluator_group_members (group_id, user_id, deleted_at)
             VALUES (?, ?, NULL)
             ON DUPLICATE KEY UPDATE deleted_at = NULL`,
            [groupId, userId]
          );
        }
      }

      res.json({ message: "평가자 그룹이 수정되었습니다." });
    });
  } catch (error) {
    handleError(res, "평가자 그룹 수정 중 오류 발생", error);
  }
});

// DELETE /api/consensus/groups/:id - 그룹 삭제
router.delete("/groups/:groupId", authenticateToken, async (req, res) => {
  const { groupId } = req.params;

  try {
    await db.withTransaction(async (conn) => {
      // 멤버 soft delete
      await conn.query(
        `UPDATE evaluator_group_members SET deleted_at = NOW()
         WHERE group_id = ?`,
        [groupId]
      );

      // 그룹 soft delete
      await conn.query(
        `UPDATE evaluator_groups SET deleted_at = NOW()
         WHERE id = ?`,
        [groupId]
      );
    });

    res.json({ message: "평가자 그룹이 삭제되었습니다." });
  } catch (error) {
    handleError(res, "평가자 그룹 삭제 중 오류 발생", error);
  }
});

// ========================================
// POST /api/consensus/import-nipa - NIPA 엑셀 데이터 임포트
// ========================================
router.post(
  "/import-nipa",
  authenticateToken,
  nipaUpload.fields([
    { name: "match2", maxCount: 1 },
    { name: "match3", maxCount: 1 },
  ]),
  async (req, res) => {
    // 관리자 권한 확인
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "관리자만 가져오기를 할 수 있습니다." });
    }

    const match2File = req.files?.["match2"]?.[0];
    const match3File = req.files?.["match3"]?.[0];

    try {
      if (!match2File || !match3File) {
        return res.status(400).json({
          message: "2인 일치 파일과 3인 일치 파일이 모두 필요합니다.",
        });
      }

      // 데이터 매핑: { assignment_type: { question_image: { match_2, match_3, boxes } } }
      const dataMap = {};

      // 2인 일치 파일 파싱
      const workbook2 = xlsx.readFile(match2File.path);
      const sheet2 = workbook2.Sheets["결과 Sheet"];
      if (sheet2) {
        const data2 = xlsx.utils.sheet_to_json(sheet2, { header: 1 });
        const header2 = data2[0];

        // 컬럼 인덱스 찾기
        const assignmentTypeIdx = header2.indexOf("과제 ID");
        const questionImageIdx = header2.indexOf("이미지");
        const match2Idx = header2.indexOf("2일치");
        const jsonIdx = header2.indexOf("JSON");

        if (assignmentTypeIdx >= 0 && questionImageIdx >= 0 && match2Idx >= 0) {
          for (let i = 1; i < data2.length; i++) {
            const row = data2[i];
            const assignmentType = String(row[assignmentTypeIdx] || "");
            const questionImage = String(row[questionImageIdx] || "");
            const match2Value = parseInt(row[match2Idx], 10) || 0;
            const jsonStr = jsonIdx >= 0 ? row[jsonIdx] : null;

            if (assignmentType && questionImage) {
              if (!dataMap[assignmentType]) dataMap[assignmentType] = {};
              if (!dataMap[assignmentType][questionImage]) {
                dataMap[assignmentType][questionImage] = { match_2: 0, match_3: 0, boxes: { match_2: [], match_3: [] } };
              }
              dataMap[assignmentType][questionImage].match_2 = match2Value;

              // JSON에서 박스 좌표 추출 (2인 일치)
              if (jsonStr) {
                try {
                  const jsonData = JSON.parse(jsonStr);
                  const boxes = [...(jsonData.mitosis || []), ...(jsonData.hardneg || [])];
                  dataMap[assignmentType][questionImage].boxes.match_2 = boxes;
                } catch (e) {
                  // JSON 파싱 실패 시 무시
                }
              }
            }
          }
        }
      }

      // 3인 일치 파일 파싱
      const workbook3 = xlsx.readFile(match3File.path);
      const sheet3 = workbook3.Sheets["결과 Sheet"];
      if (sheet3) {
        const data3 = xlsx.utils.sheet_to_json(sheet3, { header: 1 });
        const header3 = data3[0];

        // 컬럼 인덱스 찾기
        const assignmentTypeIdx = header3.indexOf("과제 ID");
        const questionImageIdx = header3.indexOf("이미지");
        const match3Idx = header3.indexOf("3일치");
        const jsonIdx = header3.indexOf("JSON");

        if (assignmentTypeIdx >= 0 && questionImageIdx >= 0 && match3Idx >= 0) {
          for (let i = 1; i < data3.length; i++) {
            const row = data3[i];
            const assignmentType = String(row[assignmentTypeIdx] || "");
            const questionImage = String(row[questionImageIdx] || "");
            const match3Value = parseInt(row[match3Idx], 10) || 0;
            const jsonStr = jsonIdx >= 0 ? row[jsonIdx] : null;

            if (assignmentType && questionImage) {
              if (!dataMap[assignmentType]) dataMap[assignmentType] = {};
              if (!dataMap[assignmentType][questionImage]) {
                dataMap[assignmentType][questionImage] = { match_2: 0, match_3: 0, boxes: { match_2: [], match_3: [] } };
              }
              dataMap[assignmentType][questionImage].match_3 = match3Value;

              // JSON에서 박스 좌표 추출 (3인 일치)
              if (jsonStr) {
                try {
                  const jsonData = JSON.parse(jsonStr);
                  const boxes = [...(jsonData.mitosis || []), ...(jsonData.hardneg || [])];
                  dataMap[assignmentType][questionImage].boxes.match_3 = boxes;
                } catch (e) {
                  // JSON 파싱 실패 시 무시
                }
              }
            }
          }
        }
      }

      // DB에 UPSERT
      let importedCount = 0;
      await db.withTransaction(async (conn) => {
        for (const [assignmentType, images] of Object.entries(dataMap)) {
          for (const [questionImage, data] of Object.entries(images)) {
            // boxes_json 직렬화
            const boxesJson = JSON.stringify(data.boxes);

            await conn.query(
              `INSERT INTO nipa_match_data
               (assignment_type, question_image, match_2, match_3, boxes_json)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
               match_2 = VALUES(match_2),
               match_3 = VALUES(match_3),
               boxes_json = VALUES(boxes_json),
               updated_at = CURRENT_TIMESTAMP,
               deleted_at = NULL`,
              [assignmentType, questionImage, data.match_2, data.match_3, boxesJson]
            );
            importedCount++;
          }
        }
      });

      // 업로드 파일 삭제
      if (match2File) fs.unlinkSync(match2File.path);
      if (match3File) fs.unlinkSync(match3File.path);

      res.json({
        message: "NIPA 데이터가 성공적으로 가져오기 되었습니다.",
        importedCount,
      });
    } catch (error) {
      // 에러 시에도 업로드 파일 삭제
      if (match2File && fs.existsSync(match2File.path)) fs.unlinkSync(match2File.path);
      if (match3File && fs.existsSync(match3File.path)) fs.unlinkSync(match3File.path);
      handleError(res, "NIPA 데이터 가져오기 중 오류 발생", error);
    }
  }
);

module.exports = router;
