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

router.get("/", async (_req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT a.id, a.title, a.creation_date AS createdAt, a.deadline AS endAt, a.assignment_mode AS assignmentMode,
      COUNT(DISTINCT au.user_id) AS evaluatorCount,
      (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id) AS totalQuestions
      FROM assignments a
      LEFT JOIN assignment_user au ON a.id = au.assignment_id
      GROUP BY a.id
    `);

    for (const assignment of assignments) {
      const totalPossibleAnswers =
        assignment.totalQuestions * assignment.evaluatorCount;

      if (assignment.assignmentMode === "BBox") {
        // BBox 모드: 각 사용자가 각 문제에 대해 사각형을 하나라도 그렸는지 확인
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
      } else {
        // TextBox 모드: 기존 로직 유지
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

    const canvasData =
      assignment_mode === "BBox"
        ? await fetchData(
            `SELECT ci.id, ci.width, ci.height, ci.user_id
             FROM canvas_info ci
             WHERE ci.assignment_id = ?`,
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
