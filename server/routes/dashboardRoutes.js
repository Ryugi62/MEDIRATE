const express = require("express");
const router = express.Router();
const db = require("../db"); // 가정: 데이터베이스 연결 설정이 포함된 모듈
const authenticateToken = require("../jwt");

require("dotenv").config();

router.get("/", async (req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS createdAt, 
        a.deadline AS endAt,
        COUNT(DISTINCT au.user_id) AS evaluatorCount,
        (
          SELECT COUNT(q.id)
          FROM questions q
          WHERE q.assignment_id = a.id
        ) AS totalQuestions,
        (
          SELECT COUNT(DISTINCT qr.question_id)
          FROM question_responses qr
          JOIN questions q ON qr.question_id = q.id
          WHERE q.assignment_id = a.id AND qr.selected_option >= 0
        ) AS answeredQuestions
      FROM assignments a
      LEFT JOIN assignment_user au ON a.id = au.assignment_id
      GROUP BY a.id
    `);

    // 답변율 및 미답변율 계산 로직을 JavaScript로 이동
    const formattedAssignments = assignments.map((assignment) => {
      const { totalQuestions, answeredQuestions } = assignment;
      const answerRate =
        totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
      const unansweredRate = 100 - answerRate;

      return {
        ...assignment,
        createdAt: assignment.createdAt.toISOString().split("T")[0],
        endAt: assignment.endAt.toISOString().split("T")[0],
        answerRate: `${answerRate.toFixed(2)}%`,
        unansweredRate: `${unansweredRate.toFixed(2)}%`,
      };
    });

    res.json(formattedAssignments);
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/:assignmentId", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;

  try {
    // Fetch users assigned to the specified assignment with their names and user IDs
    const [assignedUsers] = await db.query(
      `
      SELECT au.assignment_id, au.user_id, u.username AS name
      FROM assignment_user au
      JOIN users u ON au.user_id = u.id
      WHERE au.assignment_id = ?
    `,
      [assignmentId]
    );

    // For each user, fetch their questions and selections for the assignment
    const data = await Promise.all(
      assignedUsers.map(async (user) => {
        const [questions] = await db.query(
          `
        SELECT 
          q.id AS questionId, 
          q.image AS questionImage, 
          COALESCE(qr.selected_option, -1) AS questionSelection
        FROM questions q
        LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.user_id = ?
        WHERE q.assignment_id = ?
      `,
          [user.user_id, assignmentId]
        );

        const answeredCount = questions.filter(
          (q) => q.questionSelection !== -1
        ).length;
        const unansweredCount = questions.length - answeredCount;

        return {
          name: user.name,
          answeredCount,
          unansweredCount,
          questions: questions.map((q) => ({
            questionId: q.questionId,
            questionImage: q.questionImage,
            questionSelection: q.questionSelection,
          })),
        };
      })
    );

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 게시글 삭제
router.delete("/:id", async (req, res) => {});

module.exports = router;
