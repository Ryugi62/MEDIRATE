const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../jwt");

// 공통된 날짜 변환 및 비율 계산 함수
const formatDate = (date) => date.toISOString().split("T")[0];

const calculateRates = (answered, total, evaluatorCount) => {
  const rate = (answered / (total * evaluatorCount)) * 100;
  return `${rate.toFixed(2)}%`;
};

router.get("/", async (_req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT a.id, a.title, a.creation_date AS createdAt, a.deadline AS endAt, a.assignment_mode AS assignmentMode,
             COUNT(DISTINCT au.user_id) AS evaluatorCount,
             (SELECT COUNT(*) FROM questions q WHERE q.assignment_id = a.id) AS totalQuestions,
             (SELECT COUNT(DISTINCT qr.question_id) FROM question_responses qr JOIN questions q ON qr.question_id = q.id 
              WHERE q.assignment_id = a.id AND qr.selected_option >= 0) AS answeredQuestions
      FROM assignments a
      LEFT JOIN assignment_user au ON a.id = au.assignment_id
      GROUP BY a.id
    `);

    // Enhanced logic for BBox mode and rates calculation
    for (const assignment of assignments) {
      if (assignment.assignmentMode === "BBox") {
        const [additionalAnswers] = await db.query(
          `SELECT COUNT(DISTINCT si.question_id) AS additionalCount FROM squares_info si 
           JOIN questions q ON si.question_id = q.id WHERE q.assignment_id = ?`,
          [assignment.id]
        );

        assignment.answeredQuestions += additionalAnswers[0].additionalCount;
      }

      assignment.answerRate = calculateRates(
        assignment.answeredQuestions,
        assignment.totalQuestions,
        assignment.evaluatorCount
      );

      assignment.unansweredRate = calculateRates(
        assignment.totalQuestions * assignment.evaluatorCount -
          assignment.answeredQuestions,
        assignment.totalQuestions,
        assignment.evaluatorCount
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
      `
      SELECT u.username AS name, q.id AS questionId, q.image AS questionImage,
             COALESCE(qr.selected_option, -1) AS originalSelection, COUNT(si.id) AS squareCount
      FROM users u
      JOIN assignment_user au ON u.id = au.user_id
      LEFT JOIN questions q ON au.assignment_id = q.assignment_id
      LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.user_id = u.id
      LEFT JOIN squares_info si ON q.id = si.question_id AND si.user_id = u.id
      WHERE au.assignment_id = ?
      GROUP BY u.id, q.id
    `,
      [assignmentId]
    );

    // 사용자 ID를 지정하지 않고 모든 사각형 정보 조회
    const [squaresData] = await db.query(
      `SELECT si.id, si.question_id as questionIndex, si.x, si.y
       FROM squares_info si
       JOIN questions q ON si.question_id = q.id
       JOIN canvas_info ci ON si.canvas_id = ci.id
       WHERE q.assignment_id = ?`,
      [assignmentId]
    );

    const [canvasData] = await db.query(
      `SELECT ci.id, ci.width, ci.height
       FROM canvas_info ci
       WHERE ci.assignment_id = ?`,
      [assignmentId]
    );

    const structuredData = usersData.reduce(
      (
        acc,
        { name, questionId, questionImage, originalSelection, squareCount }
      ) => {
        const selection =
          assignment_mode === "BBox" ? squareCount : originalSelection;

        const user =
          acc[name] ||
          (acc[name] = {
            name,
            questions: [],
            answeredCount: 0,
            unansweredCount: 0,
            squares: [],
            beforeCanvas: {},
          });

        user.questions.push({
          questionId,
          questionImage,
          questionSelection: selection,
        });

        if (assignment_mode === "BBox") user.squares = squaresData;
        if (assignment_mode === "BBox") user.beforeCanvas = canvasData[0];

        selection > 0 ? user.answeredCount++ : user.unansweredCount++;

        return acc;
      },
      {}
    );

    res.status(200).json({
      assignment: Object.values(structuredData),
      assignmentMode: assignment_mode,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
