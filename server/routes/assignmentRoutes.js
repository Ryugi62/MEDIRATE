// assignmentRoutes.js

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
    is_score,
    is_ai_use,
  } = req.body;

  try {
    const insertAssignmentQuery = `
      INSERT INTO assignments (title, deadline, assignment_type, selection_type, assignment_mode, is_score, is_ai_use)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const [assignmentResult] = await db.query(insertAssignmentQuery, [
      title,
      deadline,
      assignment_type,
      selection_type,
      mode,
      is_score,
      is_ai_use,
    ]);
    const assignmentId = assignmentResult.insertId;

    await Promise.all(
      questions.map(async (question) => {
        const insertQuestionQuery = `
          INSERT INTO questions (assignment_id, image)
          VALUES (?, ?);
        `;
        await db.query(insertQuestionQuery, [assignmentId, question.img]);
      })
    );

    await Promise.all(
      users.map(async (userId) => {
        const insertUserQuery = `
          INSERT INTO assignment_user (assignment_id, user_id)
          VALUES (?, ?);
        `;
        await db.query(insertUserQuery, [assignmentId, userId]);
      })
    );

    await createCanvasForUsers(assignmentId, users);

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

    const AI_BBOX = JSON.parse(jsonContent).annotation.map((annotation) => {
      const [x, y] = annotation.bbox;
      const score = annotation.score ? annotation.score : 0.6;
      return { x, y, questionIndex: Number(questionIndex), score: score };
    });

    res.json(AI_BBOX);
  } catch (error) {
    handleError(res, "Error fetching AI assignment", error);
  }
});

router.get("/:assignmentId/ai", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    const assignmentType = questions[0].image.split("/").slice(-2)[0];

    const AI_BBOX = [];

    questions.forEach((question) => {
      const jsonSrc = question.image
        .split("/")
        .pop()
        .replace(/\.(jpg|png)/, ".json");

      try {
        const jsonContent = fs.readFileSync(
          `./assets/${assignmentType}/${jsonSrc}`,
          "utf8"
        );

        if (!jsonContent) {
          return;
        }

        const bbox = JSON.parse(jsonContent).annotation.map((annotation) => {
          const [x, y] = annotation.bbox;
          const score = annotation.score ? annotation.score : 0.6;
          return { x, y, questionIndex: question.id, score: score };
        });

        AI_BBOX.push(...bbox);
      } catch (error) {
        console.error("Error reading JSON file:", error);
      }
    });

    res.json(AI_BBOX || []);
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
          WHERE q.assignment_id = a.id AND qr.user_id = ? AND qr.selected_option <> -1) AS completed,
        ci.evaluation_time AS evaluation_time  -- 추가된 부분
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      LEFT JOIN canvas_info ci ON ci.assignment_id = a.id AND ci.user_id = au.user_id  -- 추가된 부분
      WHERE au.user_id = ?;
    `;

    const [assignments] = await db.query(assignmentsQuery, [userId, userId]);

    await Promise.all(
      assignments.map(async (assignment) => {
        const { id } = assignment;

        const canvasQuery = `SELECT id FROM canvas_info WHERE assignment_id = ?;`;
        const [canvas] = await db.query(canvasQuery, [id]);

        if (canvas.length > 0) {
          const squaresQuery = `
            SELECT DISTINCT question_id
            FROM squares_info 
            WHERE canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ?);
          `;
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

    const assignmentQuery = `
      SELECT 
        a.id, 
        a.title AS FileName, 
        u.realname AS studentName,
        a.deadline AS Deadline,
        a.selection_type AS selectionType,
        a.assignment_mode AS assignmentMode,
        a.assignment_type AS assignmentType,
        a.is_score,
        a.is_ai_use
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      JOIN users u ON au.user_id = u.id
      WHERE a.id = ? AND u.id = ?;
    `;
    const [assignment] = await db.query(assignmentQuery, [
      assignmentId,
      userId,
    ]);

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    const questionResponsesQuery = `
      SELECT qr.question_id, qr.user_id, qr.selected_option AS selectedValue
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ? AND qr.user_id = ?;
    `;
    const [responses] = await db.query(questionResponsesQuery, [
      assignmentId,
      userId,
    ]);

    const isInpsectedQuery = `SELECT question_id FROM squares_info WHERE user_id = ? AND question_id = ?;`;
    await Promise.all(
      questions.map(async (question) => {
        const [isInspected] = await db.query(isInpsectedQuery, [
          userId,
          question.id,
        ]);
        question.isInspected = isInspected.length > 0;
      })
    );

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
        isInspected: question.isInspected,
      };
    });

    const totalScore = questions.length;
    assignment[0].selectionType = assignment[0].selectionType
      .split(",")
      .map((s) => s.trim());

    const canvasQuery = `SELECT id, width, height, lastQuestionIndex, evaluation_time FROM canvas_info WHERE assignment_id = ? AND user_id = ?;`; // 수정된 부분
    const [canvas] = await db.query(canvasQuery, [assignmentId, userId]);

    let squares = [];
    if (canvas.length > 0) {
      const squaresQuery = `SELECT id, x, y, question_id as questionIndex, isAI, isTemporary FROM squares_info WHERE canvas_id = ? AND user_id = ?;`;
      const [squaresResult] = await db.query(squaresQuery, [
        canvas[0].id,
        userId,
      ]);
      squares = squaresResult;
    }

    const uniqueQuestionIndex = [
      ...new Set(squares.map((square) => square.questionIndex)),
    ];
    score += uniqueQuestionIndex.length;

    const responseData = {
      ...assignment[0],
      questions: questionsWithResponses,
      score,
      totalScore,
      beforeCanvas: canvas[0],
      squares,
    };

    res.json(responseData);
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
        a.assignment_mode AS mode,
        a.is_score,
        a.is_ai_use
      FROM assignments a
      WHERE a.id = ?;
    `;
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
      WHERE au.assignment_id = ?;
    `;
    const [assignedUsers] = await db.query(assignedUsersQuery, [assignmentId]);

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    const transformedAssignmentDetails = {
      id: assignment.id,
      title: assignment.title,
      assigment_mode: assignment.mode,
      is_score: assignment.is_score,
      is_ai_use: assignment.is_ai_use,
      deadline: assignment.deadline,
      selectedAssignmentId: assignment.selectedAssignmentId,
      selectedAssignmentType: assignment.selectedAssignmentType,
      questions: questions.map((q) => ({ id: q.id, img: q.image })),
      gradingScale: assignment.selectedAssignmentId
        ? assignment.selectedAssignmentId.split(",").map((item) => item.trim())
        : [],
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
  const {
    questions,
    beforeCanvas,
    squares,
    lastQuestionIndex,
    evaluation_time, // 추가된 부분
  } = req.body;

  console.log(
    questions,
    beforeCanvas,
    squares,
    lastQuestionIndex,
    evaluation_time
  );

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
            ON DUPLICATE KEY UPDATE selected_option = ?;
          `;
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
        SET width = ?, height = ?, lastQuestionIndex = ?, evaluation_time = ?
        WHERE assignment_id = ? AND user_id = ?;
      `;
      await db.query(updateCanvasQuery, [
        beforeCanvas.width,
        beforeCanvas.height,
        lastQuestionIndex,
        evaluation_time || 0, // 추가된 부분
        assignmentId,
        req.user.id,
      ]);
    }

    const deleteSquaresQuery = `DELETE FROM squares_info WHERE canvas_id = ? AND user_id = ?;`;
    await db.query(deleteSquaresQuery, [beforeCanvas.id, req.user.id]);

    if (squares.length > 0) {
      await Promise.all(
        squares.map(async (square) => {
          const insertSquareQuery = `
              INSERT INTO squares_info (canvas_id, x, y, question_id, user_id, isAI, isTemporary)
              VALUES (?, ?, ?, ?, ?, ?, ?);
          `;

          await db.query(insertSquareQuery, [
            beforeCanvas.id,
            square.x,
            square.y,
            square.questionIndex,
            req.user.id,
            square.isAI ? 1 : 0,
            square.isTemporary ? 1 : 0,
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
    is_score,
    is_ai_use,
  } = req.body;

  try {
    await updateAssignment({
      assignmentId,
      title,
      deadline,
      assignment_type,
      selection_type,
      mode,
      is_score,
      is_ai_use,
    });

    await updateQuestions(assignmentId, questions);

    await updateUserAssignments(assignmentId, users);

    res.json({ message: "Assignment successfully updated." });
  } catch (error) {
    console.error("Error updating assignment:", error);
    res
      .status(500)
      .send({ message: "Failed to update assignment", error: error.message });
  }
});

const updateQuestions = async (assignmentId, questions) => {
  const [existingQuestions] = await db.query(
    `SELECT id, image FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

  const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));
  const submittedQuestionIds = new Set(questions.map((q) => q.id));

  // Delete questions that are not in the submitted list
  const questionIdsToDelete = [...existingQuestionIds].filter(
    (id) => !submittedQuestionIds.has(id)
  );

  await Promise.all(
    questionIdsToDelete.map(async (questionId) => {
      await db.query(`DELETE FROM question_responses WHERE question_id = ?`, [
        questionId,
      ]);
      await db.query(`DELETE FROM questions WHERE id = ?`, [questionId]);
    })
  );

  // Update existing questions and insert new ones
  await Promise.all(
    questions.map(async (question) => {
      if (existingQuestionIds.has(question.id)) {
        // Update existing question
        await db.query(`UPDATE questions SET image = ? WHERE id = ?`, [
          question.img,
          question.id,
        ]);
      } else {
        // Insert new question
        await db.query(
          `INSERT INTO questions (assignment_id, image) VALUES (?, ?)`,
          [assignmentId, question.img]
        );
      }
    })
  );
};

const updateUserAssignments = async (assignmentId, users) => {
  const [existingUsers] = await db.query(
    `SELECT user_id FROM assignment_user WHERE assignment_id = ?`,
    [assignmentId]
  );

  const existingUserIds = new Set(existingUsers.map((u) => u.user_id));

  const usersToRemove = [...existingUserIds].filter(
    (userId) => !users.includes(userId)
  );

  const usersToAdd = users.filter((userId) => !existingUserIds.has(userId));

  // Remove users who are no longer assigned
  await Promise.all(
    usersToRemove.map(async (userId) => {
      await db.query(
        `DELETE FROM assignment_user WHERE assignment_id = ? AND user_id = ?`,
        [assignmentId, userId]
      );
      await db.query(
        `DELETE FROM canvas_info WHERE assignment_id = ? AND user_id = ?`,
        [assignmentId, userId]
      );
      await db.query(
        `DELETE FROM squares_info WHERE user_id = ? AND canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ?)`,
        [userId, assignmentId]
      );
      await db.query(
        `DELETE FROM question_responses WHERE user_id = ? AND question_id IN (SELECT id FROM questions WHERE assignment_id = ?)`,
        [userId, assignmentId]
      );
    })
  );

  // Add new users
  await Promise.all(
    usersToAdd.map(async (userId) => {
      await db.query(
        `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
        [assignmentId, userId]
      );
    })
  );

  // Create canvas for new users
  if (usersToAdd.length > 0) {
    await createCanvasForUsers(assignmentId, usersToAdd);
  }
};

const createCanvasForUsers = async (assignmentId, users) => {
  await Promise.all(
    users.map((userId) =>
      db.query(
        `INSERT INTO canvas_info (assignment_id, width, height, user_id, evaluation_time) VALUES (?, 0, 0, ?, 0)`,
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
    is_score,
    is_ai_use,
  } = params;

  const updateQuery = `
    UPDATE assignments
    SET title = ?, deadline = ?, assignment_type = ?, selection_type = ?, assignment_mode = ?, is_score = ?, is_ai_use = ?
    WHERE id = ?;
  `;

  await db.query(updateQuery, [
    title,
    deadline,
    assignment_type,
    selection_type,
    mode,
    is_score,
    is_ai_use,
    assignmentId,
  ]);
};

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [assignment] = await db.query(
      `SELECT * FROM assignments WHERE id = ?`,
      [id]
    );

    if (!assignment.length) {
      return res.status(404).send({ message: "Assignment not found." });
    } else {
      const assignmentType = assignment[0].assignment_type;

      if (fs.existsSync(`./assets/${assignmentType}`)) {
        fs.rmSync(`./assets/${assignmentType}`, { recursive: true });
      }
    }

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
