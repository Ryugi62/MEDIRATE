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
  const {
    title,
    deadline,
    assignment_type,
    selection_type,
    questions,
    users,
    mode,
  } = req.body;

  try {
    // 과제 정보를 assignments 테이블에 삽입
    const insertAssignmentQuery = `
      INSERT INTO assignments (title, deadline, assignment_type, selection_type, assignment_mode)
      VALUES (?, ?, ?, ?, ?)`;
    const [assignmentResult] = await db.query(insertAssignmentQuery, [
      title,
      deadline,
      assignment_type,
      selection_type,
      mode,
    ]);
    const assignmentId = assignmentResult.insertId;

    // 캔버스 정보를 canvas_info 테이블에 삽입 (width와 height는 NULL로 설정)
    const insertCanvasInfoQuery = `
      INSERT INTO canvas_info (assignment_id, width, height)
      VALUES (?, 0, 0)`;
    await db.query(insertCanvasInfoQuery, [assignmentId]);

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

    // Calculate scores based on whether squares exist for each assignment
    for (const assignment of assignments) {
      const { id } = assignment;

      const canvasQuery = `SELECT id FROM canvas_info WHERE assignment_id = ?`;
      const [canvas] = await db.query(canvasQuery, [id]);

      if (canvas.length > 0) {
        const squaresQuery = `
          SELECT DISTINCT question_id
          FROM squares_info 
          WHERE canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ?)`;
        const [squares] = await db.query(squaresQuery, [id]);
        assignment.completed = assignment.completed + squares.length;
      } else {
        assignment.completed = assignment.completed;
      }
    }

    console.log(assignments);

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
    const userId = req.user.id; // Assuming the JWT contains the user ID

    // 과제의 상세 정보를 가져옵니다.
    const assignmentQuery = `
      SELECT 
        a.id, 
        a.title AS FileName, 
        u.realname AS studentName,
        a.deadline AS Deadline,
        a.selection_type AS selectionType,
        a.assignment_mode AS assignmentMode
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      JOIN users u ON au.user_id = u.id
      WHERE a.id = ? AND u.id = ?`;
    const [assignment] = await db.query(assignmentQuery, [
      assignmentId,
      userId,
    ]);

    // 과제에 관련된 질문들을 가져옵니다.
    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    // 질문에 대한 응답들을 가져옵니다.
    const questionResponsesQuery = `
      SELECT qr.question_id, qr.user_id, qr.selected_option AS selectedValue
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ? AND qr.user_id = ?`;
    const [responses] = await db.query(questionResponsesQuery, [
      assignmentId,
      userId,
    ]);

    // 응답을 질문에 매핑합니다.
    let score = 0; // 현재 푼 개수를 초기화합니다.
    const questionsWithResponses = questions.map((question) => {
      const response = responses.find(
        (response) => response.question_id === question.id
      );
      if (
        response &&
        response.selectedValue != null &&
        response.selectedValue > -1
      )
        score++; // 선택한 응답이 있으면 score를 증가시킵니다.
      return {
        id: question.id,
        image: question.image,
        selectedValue: response ? response.selectedValue : null,
      };
    });

    const totalScore = questions.length; // 총 풀어야 하는 개수는 질문의 총 수입니다.
    assignment[0].selectionType = assignment[0].selectionType
      .split(",")
      .map((s) => s.trim());

    // 캔버스 정보 조회
    const canvasQuery = `SELECT id, width, height FROM canvas_info WHERE assignment_id = ?`;
    const [canvas] = await db.query(canvasQuery, [assignmentId]);

    let squares = []; // 캔버스에 그려진 사각형 정보 조회를 위한 초기화
    if (canvas.length > 0) {
      const squaresQuery = `SELECT id, x, y, question_id as questionIndex FROM squares_info WHERE canvas_id = ? AND user_id = ?`;
      const [squaresResult] = await db.query(squaresQuery, [
        canvas[0].id,
        userId,
      ]);
      squares = squaresResult; // squares 정보 업데이트
    }

    // 문제에 사각형이 하나라도 있으면 사각형이 있는 문제마다 score를 증가시킵니다.
    // 사각형에서 같은 questionIndex 있으면 중복 삭제
    const squareQuestionIndex = squares.map((square) => square.questionIndex);
    const uniqueSquareQuestionIndex = [...new Set(squareQuestionIndex)];
    score += uniqueSquareQuestionIndex.length;

    const response = {
      ...assignment[0],
      questions: questionsWithResponses,
      score,
      totalScore,
      beforeCanvas: canvas[0],
      squares, // squares 정보 추가
    };

    // 최종적으로 과제 상세 정보와 함께 score와 totalScore를 응답으로 반환합니다.
    res.json(response);
  } catch (error) {
    handleError(res, "Error fetching assignment details", error);
  }
});

router.get("/:assignmentId/all", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // 과제의 상세 정보를 가져옵니다.
    const assignmentQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.deadline,
        a.assignment_type AS selectedAssignmentType,
        a.selection_type AS selectedAssignmentId
      FROM assignments a
      WHERE a.id = ?`;
    const [assignmentDetails] = await db.query(assignmentQuery, [assignmentId]);

    if (!assignmentDetails.length) {
      return res.status(404).send({ message: "Assignment not found." });
    }

    const assignment = assignmentDetails[0];

    // 과제에 할당된 유저들을 가져옵니다.
    const assignedUsersQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.realname, 
        u.organization
      FROM assignment_user au
      JOIN users u ON au.user_id = u.id
      WHERE au.assignment_id = ?`;
    const [assignedUsers] = await db.query(assignedUsersQuery, [assignmentId]);

    // 과제에 관련된 질문들을 가져옵니다.
    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    // 과제 상세 정보에 필요한 형태로 변환합니다.
    const transformedAssignmentDetails = {
      id: assignment.id,
      title: assignment.title,
      deadline: assignment.deadline,
      selectedAssignmentId: assignment.selectedAssignmentId,
      selectedAssignmentType: assignment.selectedAssignmentType,
      questions: questions.map((q) => ({ id: q.id, img: q.image })),
      gradingScale: assignment.selectedAssignmentId
        .split(",")
        .map((item) => item.trim()),
      assignedUsers: assignedUsers.map((user) => ({
        id: user.id,
        username: user.username,
        realname: user.realname,
        organization: user.organization,
      })),
    };

    // 최종적으로 변환된 과제 상세 정보와 유저 리스트를 응답으로 반환합니다.
    res.json(transformedAssignmentDetails);
  } catch (error) {
    handleError(res, "Error fetching assignment details", error);
  }
});

router.put("/:assignmentId", authenticateToken, async (req, res) => {
  const assignmentId = req.params.assignmentId;
  const { questions, beforeCanvas, squares } = req.body;

  try {
    // 각 질문에 대한 사용자 응답을 데이터베이스에 업데이트합니다.
    for (const question of questions) {
      // 사용자가 선택한 응답이 유효한 경우에만 데이터베이스에 삽입/업데이트합니다.
      if (
        question.selectedValue !== undefined &&
        question.selectedValue !== null
      ) {
        const insertResponseQuery = `
          INSERT INTO question_responses (question_id, user_id, selected_option)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE selected_option = ?`;
        await db.query(insertResponseQuery, [
          question.id,
          req.user.id,
          question.selectedValue,
          question.selectedValue,
        ]);
      }
    }

    // 캔버스 width, height이 0이 아닌 경우에만 업데이트합니다.
    if (beforeCanvas.width !== 0 && beforeCanvas.height !== 0) {
      const updateCanvasQuery = `
        UPDATE canvas_info
        SET width = ?, height = ?
        WHERE assignment_id = ?`;
      await db.query(updateCanvasQuery, [
        beforeCanvas.width,
        beforeCanvas.height,
        assignmentId,
      ]);
    }

    // 기존 과제의 사각형들을 전부 삭제
    const deleteSquaresQuery = `DELETE FROM squares_info WHERE canvas_id = ? AND user_id = ?`;
    await db.query(deleteSquaresQuery, [beforeCanvas.id, req.user.id]);

    if (squares.length > 0) {
      // 새로운 사각형들을 삽입
      for (const square of squares) {
        const insertSquareQuery = `
            INSERT INTO squares_info (canvas_id, x, y, question_id, user_id)
            VALUES (?, ?, ?, ?, ?)`;
        await db.query(insertSquareQuery, [
          beforeCanvas.id,
          square.x,
          square.y,
          square.questionIndex,
          req.user.id,
        ]);
      } // squares 정보 업데이트
    }

    res.json({ message: "Assignment responses successfully updated." });
  } catch (error) {
    console.error("Error updating assignment responses:", error);
    res.status(500).send({
      message: "Failed to update assignment responses",
      error: error.message,
    });
  }
});

router.put("/edit/:assignmentId", authenticateToken, async (req, res) => {
  const assignmentId = req.params.assignmentId; // Extracting the assignmentId from the request parameters
  const { title, deadline, assignment_type, selection_type, questions, users } =
    req.body;

  try {
    // Start by updating the main assignment details
    const updateQuery = `
      UPDATE assignments
      SET title = ?, deadline = ?, assignment_type = ?, selection_type = ?
      WHERE id = ?`;
    await db.query(updateQuery, [
      title,
      deadline,
      assignment_type,
      selection_type,
      assignmentId,
    ]);

    // Before deleting the questions, delete any responses to those questions to avoid foreign key constraint errors
    const deleteResponsesQuery = `
      DELETE qr FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ?`;
    await db.query(deleteResponsesQuery, [assignmentId]);

    // Now it's safe to delete the questions for the assignment
    await db.query(`DELETE FROM questions WHERE assignment_id = ?`, [
      assignmentId,
    ]);

    // Clear existing users associated with this assignment
    await db.query(`DELETE FROM assignment_user WHERE assignment_id = ?`, [
      assignmentId,
    ]);

    // Re-assign users to the assignment
    await Promise.all(
      users.map((userId) =>
        db.query(
          `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
          [assignmentId, userId]
        )
      )
    );

    // Re-add questions to the assignment
    await Promise.all(
      questions.map((question) =>
        db.query(`INSERT INTO questions (assignment_id, image) VALUES (?, ?)`, [
          assignmentId,
          question.img,
        ])
      )
    );

    res.json({ message: "Assignment successfully updated." });
  } catch (error) {
    console.error("Error updating assignment:", error);
    res
      .status(500)
      .send({ message: "Failed to update assignment", error: error.message });
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
