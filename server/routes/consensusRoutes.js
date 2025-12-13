// consensusRoutes.js
// 합의(Consensus) 모드 관련 API 라우트

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");

const router = express.Router();

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send({ message, error: error.message });
};

// ========================================
// GET /api/consensus - 합의 과제 목록
// ========================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        ca.id,
        ca.title,
        ca.deadline,
        ca.source_excel,
        ca.evaluator_threshold,
        ca.score_threshold,
        ca.assignment_type,
        ca.creation_date,
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
      WHERE cua.user_id = ? AND ca.deleted_at IS NULL
      ORDER BY ca.creation_date DESC
    `;

    const [assignments] = await db.query(query, [userId, userId, userId]);

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

    // 1. 과제 정보 조회
    const [assignmentResult] = await db.query(
      `SELECT ca.*, u.realname as studentName
       FROM consensus_assignments ca
       JOIN consensus_user_assignments cua ON ca.id = cua.consensus_assignment_id AND cua.deleted_at IS NULL
       JOIN users u ON cua.user_id = u.id AND u.deleted_at IS NULL
       WHERE ca.id = ? AND cua.user_id = ? AND ca.deleted_at IS NULL`,
      [consensusId, userId]
    );

    if (assignmentResult.length === 0) {
      return res.status(404).json({ message: "합의 과제를 찾을 수 없습니다." });
    }

    const assignment = assignmentResult[0];

    // 2. FP 사각형 조회 (이미지별로 그룹화)
    const [fpSquares] = await db.query(
      `SELECT id, question_image, x, y, ai_score
       FROM consensus_fp_squares
       WHERE consensus_assignment_id = ? AND deleted_at IS NULL
       ORDER BY question_image, id`,
      [consensusId]
    );

    // 3. 사용자의 응답 조회
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

    // 4. 캔버스 정보 조회
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

    // 5. 이미지 목록 생성 (중복 제거)
    const imageSet = new Set(fpSquares.map((fp) => fp.question_image));
    const images = Array.from(imageSet).map((img) => {
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

    res.json({
      ...assignment,
      images,
      fpSquares,
      responses: responseMap,
      canvasInfo,
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
    await db.withTransaction(async (conn) => {
      // 1. consensus_assignments 생성
      const [assignmentResult] = await conn.query(
        `INSERT INTO consensus_assignments (title, deadline, source_excel, evaluator_threshold, score_threshold, assignment_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          title,
          deadline,
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
              await conn.query(
                `INSERT INTO consensus_fp_squares (consensus_assignment_id, question_image, x, y, ai_score)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  consensusAssignmentId,
                  question.image,
                  fpSquare.x,
                  fpSquare.y,
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

    res.json({
      assignment: assignment[0],
      users,
      resultData,
      timeData,
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

module.exports = router;
