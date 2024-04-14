const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");
const fs = require("fs");

const router = express.Router();

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send(message);
};

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

    await Promise.all(
      questions.map(async (question) => {
        const insertQuestionQuery = `
          INSERT INTO questions (assignment_id, image)
          VALUES (?, ?)`;
        await db.query(insertQuestionQuery, [assignmentId, question.img]);
      })
    );

    await Promise.all(
      users.map(async (userId) => {
        const insertUserQuery = `
          INSERT INTO assignment_user (assignment_id, user_id)
          VALUES (?, ?)`;
        await db.query(insertUserQuery, [assignmentId, userId]);
      })
    );

    await Promise.all(
      users.map(async (userId) => {
        const insertCanvasInfoQuery = `
          INSERT INTO canvas_info (assignment_id, width, height, user_id)
          VALUES (?, 0, 0, ?)`;
        await db.query(insertCanvasInfoQuery, [assignmentId, userId]);
      })
    );

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

router.get("/ai", authenticateToken, async (req, res) => {
  try {
    const { src, assignmentType, questionIndex } = req.query;

    const jsonSrc = src.replace(/\.(jpg|png)/, ".json");

    const jsonContent = fs.readFileSync(
      `./assets/${assignmentType}/${jsonSrc}`,
      "utf8"
    );

    const AI_BBIX = JSON.parse(jsonContent).annotation.map((annotation) => {
      const [x, y] = annotation.bbox;
      return { x, y, questionIndex: Number(questionIndex) };
    });

    res.json(AI_BBIX);
  } catch (error) {
    handleError(res, "Error fetching AI assignment", error);
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
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

    await Promise.all(
      assignments.map(async (assignment) => {
        const { id } = assignment;

        const canvasQuery = `SELECT id FROM canvas_info WHERE assignment_id = ?`;
        const [canvas] = await db.query(canvasQuery, [id]);

        if (canvas.length > 0) {
          const squaresQuery = `
            SELECT DISTINCT question_id
            FROM squares_info 
            WHERE canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ?)`;
          const [squares] = await db.query(squaresQuery, [id, userId]);
          assignment.completed += squares.length;
        }
      })
    );

    res.json(assignments);
  } catch (error) {
    handleError(
      res,
      "Unable to fetch assignments list due to server error.",
      error
    );
  }
});

router.get("/:assignmentId", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;

    console.log("assignmentId", assignmentId);

    const assignmentQuery = `
      SELECT 
        a.id, 
        a.title AS FileName, 
        u.realname AS studentName,
        a.deadline AS Deadline,
        a.selection_type AS selectionType,
        a.assignment_mode AS assignmentMode,
        a.assignment_type AS assignmentType
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      JOIN users u ON au.user_id = u.id
      WHERE a.id = ? AND u.id = ?`;
    const [assignment] = await db.query(assignmentQuery, [
      assignmentId,
      userId,
    ]);

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    const questionResponsesQuery = `
      SELECT qr.question_id, qr.user_id, qr.selected_option AS selectedValue
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ? AND qr.user_id = ?`;
    const [responses] = await db.query(questionResponsesQuery, [
      assignmentId,
      userId,
    ]);

    let score = 0;
    const questionsWithResponses = questions.map((question) => {
      const response = responses.find(
        (response) => response.question_id === question.id
      );
      if (
        response &&
        response.selectedValue != null &&
        response.selectedValue > -1
      ) {
        score++;
      }
      return {
        id: question.id,
        image: question.image,
        selectedValue: response ? response.selectedValue : null,
      };
    });

    const totalScore = questions.length;
    assignment[0].selectionType = assignment[0].selectionType
      .split(",")
      .map((s) => s.trim());

    const canvasQuery = `SELECT id, width, height FROM canvas_info WHERE assignment_id = ? AND user_id = ?`;
    const [canvas] = await db.query(canvasQuery, [assignmentId, userId]);

    let squares = [];
    if (canvas.length > 0) {
      const squaresQuery = `SELECT id, x, y, question_id as questionIndex FROM squares_info WHERE canvas_id = ? AND user_id = ?`;
      const [squaresResult] = await db.query(squaresQuery, [
        canvas[0].id,
        userId,
      ]);
      squares = squaresResult;
    }

    const squareQuestionIndex = squares.map((square) => square.questionIndex);
    const uniqueSquareQuestionIndex = [...new Set(squareQuestionIndex)];
    score += uniqueSquareQuestionIndex.length;

    const response = {
      ...assignment[0],
      questions: questionsWithResponses,
      score,
      totalScore,
      beforeCanvas: canvas[0],
      squares,
    };

    res.json(response);
  } catch (error) {
    handleError(res, "Error fetching assignment details", error);
  }
});

router.get("/:assignmentId/all", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignmentQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.deadline,
        a.assignment_type AS selectedAssignmentType,
        a.selection_type AS selectedAssignmentId,
        a.assignment_mode AS mode
      FROM assignments a
      WHERE a.id = ?`;
    const [assignmentDetails] = await db.query(assignmentQuery, [assignmentId]);

    if (!assignmentDetails.length) {
      return res.status(404).send({ message: "Assignment not found." });
    }

    const assignment = assignmentDetails[0];

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

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    const transformedAssignmentDetails = {
      id: assignment.id,
      title: assignment.title,
      assigment_mode: assignment.mode,
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

    res.json(transformedAssignmentDetails);
  } catch (error) {
    handleError(res, "Error fetching assignment details", error);
  }
});

router.put("/:assignmentId", authenticateToken, async (req, res) => {
  const assignmentId = req.params.assignmentId;
  const { questions, beforeCanvas, squares } = req.body;

  try {
    await Promise.all(
      questions.map(async (question) => {
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
      })
    );

    if (beforeCanvas.width !== 0 && beforeCanvas.height !== 0) {
      const updateCanvasQuery = `
        UPDATE canvas_info
        SET width = ?, height = ?
        WHERE assignment_id = ? AND user_id = ?`;
      await db.query(updateCanvasQuery, [
        beforeCanvas.width,
        beforeCanvas.height,
        assignmentId,
        req.user.id,
      ]);
    }

    const deleteSquaresQuery = `DELETE FROM squares_info WHERE canvas_id = ? AND user_id = ?`;
    await db.query(deleteSquaresQuery, [beforeCanvas.id, req.user.id]);

    if (squares.length > 0) {
      await Promise.all(
        squares.map(async (square) => {
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
        })
      );
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
  const { assignmentId } = req.params;
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
    const assignmentChanged = await updateAssignment({
      assignmentId,
      title,
      deadline,
      assignment_type,
      selection_type,
      mode,
    });

    await deleteCanvasForAssignmentUsers(assignmentId);
    await createCanvasForUsers(assignmentId, users);

    if (assignmentChanged) {
      await deleteResponsesAndQuestions(assignmentId);
      await addQuestions(assignmentId, questions);
      await deleteSquareInfo(assignmentId);
    }

    await updateUserAssignments(assignmentId, users);

    res.json({ message: "Assignment successfully updated." });
  } catch (error) {
    console.error("Error updating assignment:", error);
    res
      .status(500)
      .send({ message: "Failed to update assignment", error: error.message });
  }
});

const deleteCanvasForAssignmentUsers = async (assignmentId) => {
  await db.query(`DELETE FROM canvas_info WHERE assignment_id = ?`, [
    assignmentId,
  ]);
};

const createCanvasForUsers = async (assignmentId, users) => {
  await Promise.all(
    users.map((userId) =>
      db.query(
        `INSERT INTO canvas_info (assignment_id, width, height, user_id) VALUES (?, 0, 0, ?)`,
        [assignmentId, userId]
      )
    )
  );
};

const updateAssignment = async (params) => {
  const {
    assignmentId,
    title,
    deadline,
    assignment_type,
    selection_type,
    mode,
  } = params;

  const updateQuery = `
    UPDATE assignments
    SET title = ?, deadline = ?, assignment_type = ?, selection_type = ?, assignment_mode = ?
    WHERE id = ?`;

  const [originalAssignment] = await db.query(
    `SELECT * FROM assignments WHERE id = ?`,
    [assignmentId]
  );

  await db.query(updateQuery, [
    title,
    deadline,
    assignment_type,
    selection_type,
    mode,
    assignmentId,
  ]);

  return (
    originalAssignment[0].selection_type !== selection_type ||
    originalAssignment[0].assignment_type !== assignment_type ||
    originalAssignment[0].assignment_mode !== mode
  );
};

const deleteResponsesAndQuestions = async (assignmentId) => {
  await db.query(
    `DELETE qr FROM question_responses qr JOIN questions q ON qr.question_id = q.id WHERE q.assignment_id = ?`,
    [assignmentId]
  );
  await db.query(`DELETE FROM questions WHERE assignment_id = ?`, [
    assignmentId,
  ]);
};

const addQuestions = async (assignmentId, questions) => {
  await Promise.all(
    questions.map((question) =>
      db.query(`INSERT INTO questions (assignment_id, image) VALUES (?, ?)`, [
        assignmentId,
        question.img,
      ])
    )
  );
};

const deleteSquareInfo = async (assignmentId) => {
  await db.query(
    `DELETE si FROM squares_info si JOIN canvas_info ci ON si.canvas_id = ci.id WHERE ci.assignment_id = ?`,
    [assignmentId]
  );
};

const updateUserAssignments = async (assignmentId, users) => {
  await db.query(`DELETE FROM assignment_user WHERE assignment_id = ?`, [
    assignmentId,
  ]);
  await Promise.all(
    users.map((userId) =>
      db.query(
        `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
        [assignmentId, userId]
      )
    )
  );
};

// Delete assignment
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `DELETE FROM question_responses WHERE question_id IN (SELECT id FROM questions WHERE assignment_id = ?)`,
      [id]
    );

    await db.query(`DELETE FROM assignments WHERE id = ?`, [id]);
    res.send("Assignment successfully deleted.");
  } catch (error) {
    handleError(res, "Error deleting assignment", error);
  }
});

module.exports = router;
