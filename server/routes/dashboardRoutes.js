const express = require("express");
const router = express.Router();
const db = require("../db"); // 가정: 데이터베이스 연결 설정이 포함된 모듈
const authenticateToken = require("../jwt");

require("dotenv").config();

router.get("/", async (_req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS createdAt, 
        a.deadline AS endAt,
        a.assignment_mode AS assignmentMode,
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

    // Calculate answerRate and unansweredRate for each assignment
    const formattedAssignments = assignments.map((assignment) => {
      const { evaluatorCount, totalQuestions, answeredQuestions } = assignment;
      const answerRate =
        (answeredQuestions / (evaluatorCount * totalQuestions)) * 100;
      const unansweredRate = 100 - answerRate;

      return {
        ...assignment,
        createdAt: assignment.createdAt.toISOString().split("T")[0],
        endAt: assignment.endAt.toISOString().split("T")[0],
        answerRate: `${answerRate.toFixed(2)}%`,
        unansweredRate: `${unansweredRate.toFixed(2)}%`,
      };
    });

    for (const assignment of assignments) {
      if (assignment.assignmentMode === "BBox") {
        // Get the list of users who need to solve the assignment
        const [assignedUsers] = await db.query(
          `SELECT user_id FROM assignment_user WHERE assignment_id = ?`,
          [assignment.id]
        );

        for (const user of assignedUsers) {
          const [submitted] = await db.query(
            `SELECT COUNT(DISTINCT si.question_id) AS count
              FROM squares_info si
              JOIN canvas_info ci ON si.canvas_id = ci.id
              WHERE ci.assignment_id = ? AND si.user_id = ?
            `,
            [assignment.id, user.user_id]
          );

          formattedAssignments[0].answeredQuestions += submitted[0].count;

          console.log(`submitted: ${submitted[0].count}`);
        }

        const { evaluatorCount, totalQuestions, answeredQuestions } =
          formattedAssignments[0];
        const answerRate =
          (answeredQuestions / (evaluatorCount * totalQuestions)) * 100;
        const unansweredRate = 100 - answerRate;

        formattedAssignments[0].answerRate = `${answerRate.toFixed(2)}%`;
        formattedAssignments[0].unansweredRate = `${unansweredRate.toFixed(
          2
        )}%`;
      }
    }

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

    const assignmentMode = await db.query(
      `SELECT assignment_mode FROM assignments WHERE id = ?`,
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

    const result = {
      assignment: data,
      assignmentMode: assignmentMode[0][0].assignment_mode,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
