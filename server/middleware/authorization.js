/**
 * 권한 확인 미들웨어
 * 리소스 소유권 및 접근 권한을 검증합니다.
 */

const db = require("../db");

/**
 * 리소스 소유권 확인 미들웨어
 * @param {string} resourceType - 리소스 타입 ('post', 'comment')
 * @returns {Function} Express 미들웨어
 */
const checkOwnership = (resourceType) => async (req, res, next) => {
  const resourceId =
    req.params.id || req.params.commentId || req.params.postId;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // 인증되지 않은 경우
  if (!userId) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  // admin은 모든 권한 보유
  if (userRole === "admin") {
    return next();
  }

  const tableMap = {
    post: "posts",
    comment: "comments",
  };

  const table = tableMap[resourceType];

  if (!table) {
    return res.status(500).json({ error: "잘못된 리소스 타입입니다." });
  }

  try {
    const [resource] = await db.query(
      `SELECT user_id FROM \`${table}\` WHERE id = ? AND deleted_at IS NULL`,
      [resourceId]
    );

    if (!resource.length) {
      return res.status(404).json({ error: "리소스를 찾을 수 없습니다." });
    }

    if (resource[0].user_id !== userId) {
      return res.status(403).json({ error: "접근 권한이 없습니다." });
    }

    next();
  } catch (error) {
    console.error("권한 확인 오류:", error);
    res.status(500).json({ error: "권한 확인 중 오류가 발생했습니다." });
  }
};

/**
 * 관리자 권한 확인 미들웨어
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "인증이 필요합니다." });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }

  next();
};

/**
 * 삭제 전 영향 범위 확인 헬퍼
 * @param {string} type - 리소스 타입 ('user', 'assignment')
 * @param {number} id - 리소스 ID
 * @returns {Promise<Object>} 영향 받는 데이터 수
 */
const checkDeletionImpact = async (type, id) => {
  const impact = {};

  if (type === "user") {
    // 사용자 삭제 시 영향 범위
    const [assignments] = await db.query(
      `SELECT COUNT(*) as count FROM assignment_user
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [responses] = await db.query(
      `SELECT COUNT(*) as count FROM question_responses
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [canvasData] = await db.query(
      `SELECT COUNT(*) as count FROM canvas_info
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [posts] = await db.query(
      `SELECT COUNT(*) as count FROM posts
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [comments] = await db.query(
      `SELECT COUNT(*) as count FROM comments
       WHERE user_id = ? AND deleted_at IS NULL`,
      [id]
    );

    impact.assignedTasks = assignments[0].count;
    impact.evaluationResponses = responses[0].count;
    impact.canvasRecords = canvasData[0].count;
    impact.posts = posts[0].count;
    impact.comments = comments[0].count;
    impact.hasBlockingData =
      assignments[0].count > 0 ||
      responses[0].count > 0 ||
      canvasData[0].count > 0;
  }

  if (type === "assignment") {
    // 과제 삭제 시 영향 범위
    const [responses] = await db.query(
      `SELECT COUNT(*) as count FROM question_responses qr
       JOIN questions q ON qr.question_id = q.id
       WHERE q.assignment_id = ? AND qr.deleted_at IS NULL`,
      [id]
    );

    const [canvasData] = await db.query(
      `SELECT COUNT(*) as count FROM canvas_info
       WHERE assignment_id = ? AND deleted_at IS NULL`,
      [id]
    );

    const [questions] = await db.query(
      `SELECT COUNT(*) as count FROM questions
       WHERE assignment_id = ? AND deleted_at IS NULL`,
      [id]
    );

    impact.evaluationResponses = responses[0].count;
    impact.canvasRecords = canvasData[0].count;
    impact.questions = questions[0].count;
    impact.hasBlockingData = responses[0].count > 0 || canvasData[0].count > 0;
  }

  return impact;
};

module.exports = {
  checkOwnership,
  requireAdmin,
  checkDeletionImpact,
};
