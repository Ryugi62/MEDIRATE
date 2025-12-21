const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../jwt");

// 공통된 날짜 변환 및 비율 계산 함수
const formatDate = (date) => date.toISOString().split("T")[0];
const calculateRates = (answered, total) => {
  const rate = (answered / total) * 100;
  return `${rate.toFixed(2)}%`;
};

// 페이지네이션 지원 대시보드 API
router.get("/paginated", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = "",
      mode = "all",
      tag = "all",
      sortBy = "id",
      sortDir = "desc",
      projectId = null,
      cancerId = null,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // WHERE 조건 구성
    let whereConditions = ["a.deleted_at IS NULL"];
    let params = [];

    if (search) {
      whereConditions.push("a.title LIKE ?");
      params.push(`${search}%`);
    }

    if (mode !== "all") {
      whereConditions.push("a.assignment_mode = ?");
      params.push(mode);
    }

    if (tag !== "all") {
      whereConditions.push(`
        EXISTS (
          SELECT 1 FROM assignment_tags at2
          JOIN tags t2 ON at2.tag_id = t2.id
          WHERE at2.assignment_id = a.id AND t2.name = ? AND t2.deleted_at IS NULL
        )
      `);
      params.push(tag);
    }

    // 프로젝트 필터
    if (projectId && projectId !== "null") {
      if (projectId === "unclassified") {
        whereConditions.push("a.project_id IS NULL");
      } else {
        whereConditions.push("a.project_id = ?");
        params.push(parseInt(projectId));
      }
    }

    // 암종 필터
    if (cancerId && cancerId !== "null") {
      if (cancerId === "unclassified") {
        whereConditions.push("a.cancer_type_id IS NULL");
      } else {
        whereConditions.push("a.cancer_type_id = ?");
        params.push(parseInt(cancerId));
      }
    }

    const whereClause = whereConditions.join(" AND ");

    // 정렬 컬럼 매핑
    const sortColumnMap = {
      id: "a.id",
      mode: "a.assignment_mode",
      title: "a.title",
      createdAt: "a.creation_date",
      endAt: "a.deadline",
      evaluatorCount: "evaluatorCount",
    };
    const sortColumn = sortColumnMap[sortBy] || "a.id";
    const sortDirection = sortDir === "up" ? "ASC" : "DESC";

    // 전체 개수 조회
    const [countResult] = await db.query(
      `SELECT COUNT(DISTINCT a.id) as total
       FROM assignments a
       WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 페이지네이션된 데이터 조회
    const [assignments] = await db.query(
      `SELECT a.id, a.title, a.creation_date AS createdAt, a.deadline AS endAt,
              a.assignment_mode AS assignmentMode,
              COUNT(DISTINCT au.user_id) AS evaluatorCount,
              (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id AND q.deleted_at IS NULL) AS totalQuestions
       FROM assignments a
       LEFT JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
       WHERE ${whereClause}
       GROUP BY a.id, a.title, a.creation_date, a.deadline, a.assignment_mode
       ORDER BY ${sortColumn} ${sortDirection}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // 각 과제의 태그 및 답변율 계산
    for (const assignment of assignments) {
      // 태그 조회
      const [tags] = await db.query(
        `SELECT t.id, t.name, t.color
         FROM tags t
         JOIN assignment_tags at ON t.id = at.tag_id
         WHERE at.assignment_id = ? AND t.deleted_at IS NULL`,
        [assignment.id]
      );
      assignment.tags = tags;

      // 답변율 계산
      const totalPossibleAnswers = assignment.totalQuestions * assignment.evaluatorCount;

      if (assignment.assignmentMode === "BBox" || assignment.assignmentMode === "Segment") {
        const [bboxAnswers] = await db.query(
          `SELECT COUNT(*) AS answeredQuestions
           FROM (
             SELECT DISTINCT si.user_id, q.id
             FROM questions q
             JOIN squares_info si ON q.id = si.question_id AND si.deleted_at IS NULL
             WHERE q.assignment_id = ? AND q.deleted_at IS NULL
           ) AS user_question_combinations`,
          [assignment.id]
        );
        assignment.answeredQuestions = bboxAnswers[0].answeredQuestions;
      } else {
        const [answeredQuestions] = await db.query(
          `SELECT COUNT(*) AS count
           FROM question_responses qr
           JOIN questions q ON qr.question_id = q.id
           WHERE q.assignment_id = ? AND qr.selected_option >= 0
           AND qr.deleted_at IS NULL AND q.deleted_at IS NULL`,
          [assignment.id]
        );
        assignment.answeredQuestions = answeredQuestions[0].count;
      }

      assignment.answerRate = calculateRates(assignment.answeredQuestions, totalPossibleAnswers);
      assignment.unansweredRate = calculateRates(totalPossibleAnswers - assignment.answeredQuestions, totalPossibleAnswers);
      assignment.createdAt = formatDate(new Date(assignment.createdAt));
      assignment.endAt = formatDate(new Date(assignment.endAt));
    }

    // 전체 태그 목록 (필터용)
    const [allTags] = await db.query(`
      SELECT t.name, COUNT(at.assignment_id) as count
      FROM tags t
      JOIN assignment_tags at ON t.id = at.tag_id
      JOIN assignments a ON at.assignment_id = a.id AND a.deleted_at IS NULL
      WHERE t.deleted_at IS NULL
      GROUP BY t.id
      ORDER BY count DESC
    `);

    res.json({
      data: assignments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      allTags,
    });
  } catch (error) {
    console.error("Failed to fetch paginated assignments:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 기존 API (하위 호환성 유지)
router.get("/", async (_req, res) => {
  try {
    // 삭제되지 않은 과제만 조회
    const [assignments] = await db.query(`
      SELECT a.id, a.title, a.creation_date AS createdAt, a.deadline AS endAt, a.assignment_mode AS assignmentMode,
      COUNT(DISTINCT au.user_id) AS evaluatorCount,
      (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id AND q.deleted_at IS NULL) AS totalQuestions
      FROM assignments a
      LEFT JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
      WHERE a.deleted_at IS NULL
      GROUP BY a.id
    `);

    // 각 과제의 태그 조회
    for (const assignment of assignments) {
      const [tags] = await db.query(
        `SELECT t.id, t.name, t.color
         FROM tags t
         JOIN assignment_tags at ON t.id = at.tag_id
         WHERE at.assignment_id = ? AND t.deleted_at IS NULL`,
        [assignment.id]
      );
      assignment.tags = tags;
    }

    for (const assignment of assignments) {
      const totalPossibleAnswers =
        assignment.totalQuestions * assignment.evaluatorCount;

      if (assignment.assignmentMode === "BBox" || assignment.assignmentMode === "Segment") {
        // BBox/Segment 모드: 각 사용자가 각 문제에 대해 사각형을 하나라도 그렸는지 확인
        const [bboxAnswers] = await db.query(
          `
          SELECT COUNT(*) AS answeredQuestions
          FROM (
            SELECT DISTINCT si.user_id, q.id
            FROM questions q
            JOIN squares_info si ON q.id = si.question_id AND si.deleted_at IS NULL
            WHERE q.assignment_id = ? AND q.deleted_at IS NULL
          ) AS user_question_combinations
          `,
          [assignment.id]
        );
        assignment.answeredQuestions = bboxAnswers[0].answeredQuestions;
      } else {
        // TextBox 모드: 기존 로직 유지
        const [answeredQuestions] = await db.query(
          `
          SELECT COUNT(*) AS count
          FROM question_responses qr
          JOIN questions q ON qr.question_id = q.id
          WHERE q.assignment_id = ? AND qr.selected_option >= 0
          AND qr.deleted_at IS NULL AND q.deleted_at IS NULL
          `,
          [assignment.id]
        );
        assignment.answeredQuestions = answeredQuestions[0].count;
      }

      assignment.answerRate = calculateRates(
        assignment.answeredQuestions,
        totalPossibleAnswers,
        1 // evaluatorCount는 이미 totalPossibleAnswers에 포함되어 있으므로 1로 설정
      );
      assignment.unansweredRate = calculateRates(
        totalPossibleAnswers - assignment.answeredQuestions,
        totalPossibleAnswers,
        1 // 마찬가지로 1로 설정
      );
      assignment.createdAt = formatDate(new Date(assignment.createdAt));
      assignment.endAt = formatDate(new Date(assignment.endAt));
    }

    res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/:assignmentId", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  try {
    // 삭제되지 않은 과제만 조회
    const [[{ assignment_mode }]] = await db.query(
      `SELECT assignment_mode FROM assignments WHERE id = ? AND deleted_at IS NULL`,
      [assignmentId]
    );
    console.log("[DEBUG] dashboard/:id - assignment_mode from DB:", assignment_mode);

    // 삭제되지 않은 데이터만 조회
    const [usersData] = await db.query(
      `SELECT u.username AS name, q.id AS questionId, q.image AS questionImage, u.id AS userId, a.title As FileName,
       COALESCE(qr.selected_option, -1) AS originalSelection, COUNT(DISTINCT si.id) AS squareCount
       FROM users u
       JOIN assignment_user au ON u.id = au.user_id AND au.deleted_at IS NULL
       JOIN assignments a ON au.assignment_id = a.id AND a.deleted_at IS NULL
       LEFT JOIN questions q ON au.assignment_id = q.assignment_id AND q.deleted_at IS NULL
       LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.user_id = u.id AND qr.deleted_at IS NULL
       LEFT JOIN squares_info si ON q.id = si.question_id AND si.user_id = u.id AND si.deleted_at IS NULL
       WHERE au.assignment_id = ? AND u.deleted_at IS NULL
       GROUP BY u.id, q.id`,
      [assignmentId]
    );

    const fetchData = async (query, params) => {
      const [data] = await db.query(query, params);
      return data;
    };

    const squaresData =
      assignment_mode === "BBox" || assignment_mode === "Segment"
        ? await fetchData(
            `SELECT DISTINCT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
             FROM (
               SELECT question_id, x, y, user_id, isAI, isTemporary,
                      ROW_NUMBER() OVER (PARTITION BY question_id, x, y, user_id ORDER BY id) as rn
               FROM squares_info
               WHERE deleted_at IS NULL
             ) si
             JOIN questions q ON si.question_id = q.id AND q.deleted_at IS NULL
             WHERE q.assignment_id = ? AND si.rn = 1`,
            [assignmentId]
          )
        : [];

    const canvasData =
      assignment_mode === "BBox" || assignment_mode === "Segment"
        ? await fetchData(
            `SELECT ci.id, ci.width, ci.height, ci.user_id
             FROM canvas_info ci
             WHERE ci.assignment_id = ? AND ci.deleted_at IS NULL`,
            [assignmentId]
          )
        : [];

    let fileName = "";

    const structuredData = usersData.reduce((acc, user) => {
      const {
        name,
        questionId,
        questionImage,
        userId,
        FileName,
        originalSelection,
        squareCount,
      } = user;
      if (!fileName) {
        fileName = FileName;
      }
      const selection =
        assignment_mode === "BBox" ? squareCount : originalSelection;
      if (!acc[name]) {
        acc[name] = {
          name,
          userId,
          questions: [],
          answeredCount: 0,
          unansweredCount: 0,
        };
        if (assignment_mode === "BBox") {
          acc[name].squares = squaresData.filter(
            (square) => square.user_id === userId
          );
          acc[name].beforeCanvas = canvasData.find(
            (canvas) => canvas.user_id === userId
          );
        }
      }

      acc[name].questions.push({
        questionId,
        questionImage,
        questionSelection: selection,
      });
      selection > 0 ? acc[name].answeredCount++ : acc[name].unansweredCount++;
      return acc;
    }, {});

    Object.values(structuredData).forEach((user) =>
      user.questions.sort((a, b) => a.questionId - b.questionId)
    );

    res.status(200).json({
      assignment: Object.values(structuredData),
      assignmentMode: assignment_mode,
      FileName: fileName,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
