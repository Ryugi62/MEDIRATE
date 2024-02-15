const express = require("express");
const router = express.Router();
const db = require("../db"); // Assuming database connection module exists

const authenticateToken = require("../jwt");

// Common error handling function
function handleError(res, message, error) {
  console.error(message, error);
  res.status(500).send(message);
}

// Assuming db is a configured MySQL database connection
// and authenticateToken is middleware for JWT verification

router.post("/", authenticateToken, async (req, res) => {
  const { title, deadline, assignment_type, selection_type, questions, users } =
    req.body;

  try {
    const insertAssignmentQuery = `
      INSERT INTO assignments (title, deadline, assignment_type, selection_type)
      VALUES (?, ?, ?, ?)`;
    const [assignmentResult] = await db.query(insertAssignmentQuery, [
      title,
      deadline,
      assignment_type,
      selection_type,
    ]);

    const assignmentId = assignmentResult.insertId;

    for (const question of questions) {
      const insertQuestionQuery = `
        INSERT INTO questions (assignment_id, image)
        VALUES (?, ?)`;
      await db.query(insertQuestionQuery, [assignmentId, question.img]);
    }

    for (const userId of users) {
      const insertUserQuery = `
        INSERT INTO assignment_user (assignment_id, user_id)
        VALUES (?, ?)`;
      await db.query(insertUserQuery, [assignmentId, userId]);
    }

    res
      .status(201)
      .json({ message: "Assignment created successfully", assignmentId });
  } catch (error) {
    console.error("Error during assignment creation:", error);
    res
      .status(500)
      .json({ message: "Failed to create assignment", error: error.message });
  }
});

// List assignments for a user
// List assignments for a user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Assuming the JWT contains the user ID
    const assignmentsQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS CreationDate,
        a.deadline AS dueDate,
        CASE
          WHEN a.deadline >= CURRENT_DATE THEN '진행 중'
          ELSE '완료'
        END AS status,
        (SELECT COUNT(*) FROM questions WHERE assignment_id = a.id) AS total,
        (SELECT COUNT(*) FROM questions q
          JOIN question_responses qr ON q.id = qr.question_id
          WHERE q.assignment_id = a.id AND qr.user_id = ?) AS completed
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      WHERE au.user_id = ?`;

    const [assignments] = await db.query(assignmentsQuery, [userId, userId]);
    res.json(assignments);
  } catch (error) {
    handleError(
      res,
      "Unable to fetch assignments list due to server error.",
      error
    );
  }
});

// Assignment details
router.get("/:assignmentId", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignmentQuery = `SELECT * FROM assignments WHERE id = ?`;
    const [assignment] = await db.query(assignmentQuery, [assignmentId]);

    // Fetch related questions for the assignment
    const questionsQuery = `SELECT * FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    res.json({ ...assignment[0], questions });
  } catch (error) {
    handleError(res, "Error fetching assignment details", error);
  }
});

// Update assignment
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, deadline, assignment_type, selection_type } = req.body;
    const updateQuery = `
      UPDATE assignments 
      SET title = ?, deadline = ?, assignment_type = ?, selection_type = ?
      WHERE id = ?`;

    await db.query(updateQuery, [
      title,
      deadline,
      assignment_type,
      selection_type,
      id,
    ]);

    res.send("Assignment successfully updated.");
  } catch (error) {
    handleError(res, "Error updating assignment", error);
  }
});

// Delete assignment
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM assignments WHERE id = ?`, [id]);
    res.send("Assignment successfully deleted.");
  } catch (error) {
    handleError(res, "Error deleting assignment", error);
  }
});

// 사용자 목록 조회
router.post("/user-list", async (req, res) => {
  try {
    const usersQuery = `SELECT id, username, realname FROM users`; // 가정: users 테이블이 존재하며, id, username, realname 컬럼을 가짐
    const [users] = await db.query(usersQuery);
    res.json(users);
  } catch (error) {
    handleError(res, "Unable to fetch user list due to server error.", error);
  }
});

module.exports = router;
