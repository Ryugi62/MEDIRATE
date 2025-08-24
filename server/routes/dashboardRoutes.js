const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../jwt");

// 날짜 및 시간 형식 변환 함수 (YYYY-MM-DD HH:MM:SS)
const formatDateTime = (date) => {
  // 화면 표준: 유효하지 않은 날짜는 'N/A' 대신 '-'로 표기
  if (!date || isNaN(new Date(date))) return "-";
  const d = new Date(date);
  return (
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2) +
    " " +
    ("0" + d.getHours()).slice(-2) +
    ":" +
    ("0" + d.getMinutes()).slice(-2) +
    ":" +
    ("0" + d.getSeconds()).slice(-2)
  );
};

// 비율 계산 함수
const calculateRates = (answered, total) => {
  if (total === 0) return "0.00%";
  const rate = (answered / total) * 100;
  return `${rate.toFixed(2)}%`;
};

router.get("/", async (req, res) => {
  try {
    const { assignment_mode, cancer_type, folder_name } = req.query;

    let whereClauses = [];
    let queryParams = [];

    if (assignment_mode) {
      whereClauses.push("a.assignment_mode = ?");
      queryParams.push(assignment_mode);
    }
    if (cancer_type) {
      whereClauses.push("a.cancer_type = ?");
      queryParams.push(cancer_type);
    }
    if (folder_name) {
      whereClauses.push("a.folder_name = ?");
      queryParams.push(folder_name);
    }

    const whereClause = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const assignmentsQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS createdAt,
        a.cancer_type,
        a.folder_name,
        a.assignment_mode AS assignmentMode,
        (SELECT MAX(ci.end_time) FROM canvas_info ci WHERE ci.assignment_id = a.id) as endAt,
        (SELECT SUM(ci.evaluation_time) FROM canvas_info ci WHERE ci.assignment_id = a.id) as duration,
        COUNT(DISTINCT au.user_id) AS evaluatorCount,
        (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id) AS totalQuestions
      FROM assignments a
      LEFT JOIN assignment_user au ON a.id = au.assignment_id
      ${whereClause}
      GROUP BY a.id
    `;

    const [assignments] = await db.query(assignmentsQuery, queryParams);

    for (const assignment of assignments) {
      const totalPossibleAnswers =
        assignment.totalQuestions * assignment.evaluatorCount;

      if (assignment.assignmentMode === "BBox") {
        const [bboxAnswers] = await db.query(
          `
          SELECT COUNT(*) AS answeredQuestions
          FROM (
            SELECT DISTINCT si.user_id, q.id
            FROM questions q
            JOIN squares_info si ON q.id = si.question_id
            WHERE q.assignment_id = ?
          ) AS user_question_combinations
          `,
          [assignment.id]
        );
        assignment.answeredQuestions = bboxAnswers[0].answeredQuestions;
      } else if (assignment.assignmentMode === "Polygon") {
        const [polygonAnswers] = await db.query(
          `
          SELECT COUNT(*) AS answeredQuestions
          FROM (
            SELECT DISTINCT pi.user_id, q.id
            FROM questions q
            JOIN polygon_info pi ON q.id = pi.question_id
            WHERE q.assignment_id = ?
          ) AS user_question_combinations
          `,
          [assignment.id]
        );
        assignment.answeredQuestions = polygonAnswers[0].answeredQuestions;
      } else {
        const [answeredQuestions] = await db.query(
          `
          SELECT COUNT(*) AS count
          FROM question_responses qr
          JOIN questions q ON qr.question_id = q.id
          WHERE q.assignment_id = ? AND qr.selected_option >= 0
          `,
          [assignment.id]
        );
        assignment.answeredQuestions = answeredQuestions[0].count;
      }

      assignment.answerRate = calculateRates(
        assignment.answeredQuestions,
        totalPossibleAnswers
      );
      assignment.unansweredRate = calculateRates(
        totalPossibleAnswers - assignment.answeredQuestions,
        totalPossibleAnswers
      );
      assignment.createdAt = formatDateTime(assignment.createdAt);
      assignment.endAt = formatDateTime(assignment.endAt);
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
    const [[{ assignment_mode }]] = await db.query(
      `SELECT assignment_mode FROM assignments WHERE id = ?`,
      [assignmentId]
    );

    const [usersData] = await db.query(
      `SELECT u.username AS name, q.id AS questionId, q.image AS questionImage, u.id AS userId, a.title As FileName,
       COALESCE(qr.selected_option, -1) AS originalSelection, COUNT(DISTINCT si.id) AS squareCount
       FROM users u
       JOIN assignment_user au ON u.id = au.user_id
       JOIN assignments a ON au.assignment_id = a.id
       LEFT JOIN questions q ON au.assignment_id = q.assignment_id
       LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.user_id = u.id
       LEFT JOIN squares_info si ON q.id = si.question_id AND si.user_id = u.id
       WHERE au.assignment_id = ?
       GROUP BY u.id, q.id`,
      [assignmentId]
    );

    const fetchData = async (query, params) => {
      const [data] = await db.query(query, params);
      return data;
    };

    const squaresData =
      assignment_mode === "BBox"
        ? await fetchData(
            `SELECT DISTINCT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
             FROM (
               SELECT question_id, x, y, user_id, isAI, isTemporary,
                      ROW_NUMBER() OVER (PARTITION BY question_id, x, y, user_id ORDER BY id) as rn
               FROM squares_info
             ) si
             JOIN questions q ON si.question_id = q.id
             WHERE q.assignment_id = ? AND si.rn = 1`,
            [assignmentId]
          )
        : [];

    // Polygon 모드: 사용자별 폴리곤과 캔버스 정보 조회
    const polygonsData =
      assignment_mode === "Polygon"
        ? await fetchData(
            `SELECT pi.question_id AS questionIndex, pi.coordinates, pi.class_type AS classType, pi.user_id
             FROM polygon_info pi
             JOIN questions q ON pi.question_id = q.id
             WHERE q.assignment_id = ?`,
            [assignmentId]
          )
        : [];

    const canvasData = await fetchData(
      `SELECT ci.id, ci.width, ci.height, ci.user_id
       FROM canvas_info ci
       WHERE ci.assignment_id = ?`,
      [assignmentId]
    );

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
      let selection = originalSelection;
      if (assignment_mode === "BBox") {
        selection = squareCount;
      } else if (assignment_mode === "Polygon") {
        // 해당 사용자/문항의 폴리곤 개수
        const userPolygonCount = polygonsData.filter(
          (p) => p.user_id === userId && p.questionIndex === questionId
        ).length;
        selection = userPolygonCount;
      }
      if (!acc[name]) {
        acc[name] = {
          name,
          userId,
          questions: [],
          answeredCount: 0,
          unansweredCount: 0,
        };
        // 공통 beforeCanvas (뷰어에서 스케일 계산용)
        acc[name].beforeCanvas = canvasData.find(
          (canvas) => canvas.user_id === userId
        );
        if (assignment_mode === "BBox") {
          acc[name].squares = squaresData.filter(
            (square) => square.user_id === userId
          );
        } else if (assignment_mode === "Polygon") {
          acc[name].polygons = polygonsData
            .filter((p) => p.user_id === userId)
            .map((p) => ({
              points: JSON.parse(p.coordinates || "[]"),
              class: p.classType,
              isComplete: true,
              questionIndex: p.questionIndex,
            }));
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
