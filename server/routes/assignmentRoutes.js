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
router.get("/", authenticateToken, async (req, res) => {
  console.log("req.user", req.user);

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
          WHERE q.assignment_id = a.id AND qr.user_id = ? AND qr.selected_option <> -1) AS completed
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
    const assignmentQuery = `
      SELECT 
        a.id, 
        a.title AS FileName, 
        u.realname AS studentName,
        a.deadline AS Deadline
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      JOIN users u ON au.user_id = u.id
      WHERE a.id = ?`;
    const [assignment] = await db.query(assignmentQuery, [assignmentId]);

    // Fetch related questions for the assignment
    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    // Fetch responses for the questions
    const questionResponsesQuery = `
      SELECT qr.question_id, qr.user_id, qr.selected_option AS selectedValue
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ?`;
    const [responses] = await db.query(questionResponsesQuery, [assignmentId]);

    // Map responses to questions
    const questionsWithResponses = questions.map((question) => {
      const response = responses.find(
        (response) => response.question_id === question.id
      );
      return {
        id: question.id,
        image: question.image,
        selectedValue: response ? response.selectedValue : null,
      };
    });

    res.json({ ...assignment[0], questions: questionsWithResponses });
  } catch (error) {
    handleError(res, "Error fetching assignment details", error);
  }
});

// Update or insert assignment response
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { questions } = req.body;
    const userId = req.user.id; // 사용자 ID는 JWT에서 가져옵니다.

    // MySQL 연결 풀에서 연결을 가져옵니다.
    const connection = await db.getConnection();

    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

      // 모든 답변을 순회하며 업데이트 또는 삽입
      for (const question of questions) {
        const selectedValue = question.selectedValue || -1;

        // 이미 답변이 있는지 확인합니다.
        const checkResponseQuery = `
          SELECT COUNT(*) AS count
          FROM question_responses
          WHERE question_id = ? AND user_id = ?`;
        const [rows] = await connection.execute(checkResponseQuery, [
          question.id,
          userId,
        ]);
        const responseCount = rows[0].count;

        if (responseCount === 0) {
          // 답변이 없으면 삽입합니다.
          const insertResponseQuery = `
            INSERT INTO question_responses (question_id, user_id, selected_option)
            VALUES (?, ?, ?)`;
          await connection.execute(insertResponseQuery, [
            question.id,
            userId,
            selectedValue,
          ]);
        } else {
          // 답변이 있으면 업데이트합니다.
          const updateResponseQuery = `
            UPDATE question_responses
            SET selected_option = ?
            WHERE question_id = ? AND user_id = ?`;
          await connection.execute(updateResponseQuery, [
            selectedValue,
            question.id,
            userId,
          ]);
        }
      }

      // 트랜잭션 커밋
      await connection.commit();

      res.send("Answers successfully updated or inserted.");
    } catch (error) {
      // 트랜잭션 롤백
      await connection.rollback();
      throw error; // 에러를 상위 핸들러로 다시 던집니다.
    } finally {
      // 연결 반환
      connection.release();
    }
  } catch (error) {
    handleError(res, "Error updating or inserting answers", error);
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
