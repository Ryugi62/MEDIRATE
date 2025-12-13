// assignmentRoutes.js

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

const router = express.Router();

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send(message);
};

// 과제 생성
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

// AI 데이터 가져오기
router.get("/ai", authenticateToken, async (req, res) => {
  try {
    const { src, assignmentType, questionIndex } = req.query;

    const jsonSrc = src.replace(/\.(jpg|png)/, ".json");

    // Asynchronous file reading with fs.promises.readFile
    const jsonContent = await fsPromises.readFile(
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

// 특정 과제의 AI 데이터 가져오기
router.get("/:assignmentId/ai", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    if (questions.length === 0) {
      return res
        .status(404)
        .json({ message: "No questions found for this assignment." });
    }

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

        const parsed = JSON.parse(jsonContent);
        const annotations = parsed.annotation;

        if (!annotations || !Array.isArray(annotations)) {
          return;
        }

        const bbox = annotations.map((annotation) => {
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

// 과제 목록 가져오기
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
        (SELECT COUNT(*) FROM questions WHERE assignment_id = a.id AND deleted_at IS NULL) AS total,
        (SELECT COUNT(*) FROM questions q
          JOIN question_responses qr ON q.id = qr.question_id
          WHERE q.assignment_id = a.id AND qr.user_id = ? AND qr.selected_option <> -1
          AND q.deleted_at IS NULL AND qr.deleted_at IS NULL) AS completed,
        ci.evaluation_time AS evaluation_time,
        ci.start_time AS start_time,
        ci.end_time AS end_time
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
      LEFT JOIN canvas_info ci ON ci.assignment_id = a.id AND ci.user_id = au.user_id AND ci.deleted_at IS NULL
      WHERE au.user_id = ? AND a.deleted_at IS NULL;
    `;

    const [assignments] = await db.query(assignmentsQuery, [userId, userId]);

    const uniqueAssignments = assignments.filter(
      (value, index, self) => index === self.findIndex((t) => t.id === value.id)
    );

    await Promise.all(
      uniqueAssignments.map(async (assignment) => {
        const { id } = assignment;

        const canvasQuery = `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL;`;
        const [canvas] = await db.query(canvasQuery, [id, userId]);

        if (canvas.length > 0) {
          const squaresQuery = `
            SELECT DISTINCT question_id
            FROM squares_info
            WHERE canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL)
            AND deleted_at IS NULL;
          `;
          const [squares] = await db.query(squaresQuery, [id, userId]);
          assignment.completed += squares.length;
        }
      })
    );

    res.json(uniqueAssignments);
  } catch (error) {
    handleError(
      res,
      "Unable to fetch assignments list due to server error.",
      error
    );
  }
});

// 특정 과제 상세 정보 가져오기
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
      JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
      JOIN users u ON au.user_id = u.id AND u.deleted_at IS NULL
      WHERE a.id = ? AND u.id = ? AND a.deleted_at IS NULL;
    `;
    const [assignment] = await db.query(assignmentQuery, [
      assignmentId,
      userId,
    ]);

    if (assignment.length === 0) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    const questionResponsesQuery = `
      SELECT qr.question_id, qr.user_id, qr.selected_option AS selectedValue
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ? AND qr.user_id = ? AND qr.deleted_at IS NULL AND q.deleted_at IS NULL;
    `;
    const [responses] = await db.query(questionResponsesQuery, [
      assignmentId,
      userId,
    ]);

    const isInspectedQuery = `SELECT question_id FROM squares_info WHERE user_id = ? AND question_id = ? AND deleted_at IS NULL;`;
    await Promise.all(
      questions.map(async (question) => {
        const [isInspected] = await db.query(isInspectedQuery, [
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

    const canvasQuery = `SELECT id, width, height, lastQuestionIndex, evaluation_time, start_time, end_time FROM canvas_info WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL;`;
    const [canvas] = await db.query(canvasQuery, [assignmentId, userId]);

    let squares = [];
    if (canvas.length > 0) {
      const squaresQuery = `SELECT id, x, y, question_id as questionIndex, isAI, isTemporary FROM squares_info WHERE canvas_id = ? AND user_id = ? AND deleted_at IS NULL;`;
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

// 모든 과제 상세 정보 가져오기
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
      WHERE a.id = ? AND a.deleted_at IS NULL;
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
      JOIN users u ON au.user_id = u.id AND u.deleted_at IS NULL
      WHERE au.assignment_id = ? AND au.deleted_at IS NULL;
    `;
    const [assignedUsers] = await db.query(assignedUsersQuery, [assignmentId]);

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL;`;
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

// 과제 응답 업데이트
router.put("/:assignmentId", authenticateToken, async (req, res) => {
  const assignmentId = req.params.assignmentId;
  const {
    questions,
    beforeCanvas,
    squares,
    lastQuestionIndex,
    evaluation_time, // 추가된 부분
  } = req.body;

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
        SET width = ?, height = ?, lastQuestionIndex = ?, evaluation_time = ?,
            start_time = IF(start_time IS NULL, CONVERT_TZ(NOW(), 'UTC', 'Asia/Seoul'), start_time),
            end_time = CONVERT_TZ(NOW(), 'UTC', 'Asia/Seoul')
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

// 과제 수정
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

// 과제 질문 업데이트 함수
const updateQuestions = async (assignmentId, questions) => {
  const [existingQuestions] = await db.query(
    `SELECT id, image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL`,
    [assignmentId]
  );

  const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));
  const submittedQuestionIds = new Set(questions.map((q) => q.id));

  // 제출된 목록에 없는 질문 삭제
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

  // 기존 질문 업데이트 및 새로운 질문 삽입
  await Promise.all(
    questions.map(async (question) => {
      if (existingQuestionIds.has(question.id)) {
        // 기존 질문 업데이트
        await db.query(`UPDATE questions SET image = ? WHERE id = ?`, [
          question.img,
          question.id,
        ]);
      } else {
        // 새로운 질문 삽입
        await db.query(
          `INSERT INTO questions (assignment_id, image) VALUES (?, ?)`,
          [assignmentId, question.img]
        );
      }
    })
  );
};

// 과제 사용자 할당 업데이트 함수
const updateUserAssignments = async (assignmentId, users) => {
  const [existingUsers] = await db.query(
    `SELECT user_id FROM assignment_user WHERE assignment_id = ? AND deleted_at IS NULL`,
    [assignmentId]
  );

  const existingUserIds = new Set(existingUsers.map((u) => u.user_id));

  const usersToRemove = [...existingUserIds].filter(
    (userId) => !users.includes(userId)
  );
  const usersToAdd = users.filter((userId) => !existingUserIds.has(userId));

  // 할당 해제된 사용자 삭제
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

  // 새로운 사용자 할당
  await Promise.all(
    usersToAdd.map(async (userId) => {
      await db.query(
        `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
        [assignmentId, userId]
      );
    })
  );

  // 새로운 사용자용 캔버스 생성
  if (usersToAdd.length > 0) {
    await createCanvasForUsers(assignmentId, usersToAdd);
  }
};

// 사용자용 캔버스 생성 함수
const createCanvasForUsers = async (assignmentId, users) => {
  await Promise.all(
    users.map((userId) =>
      db.query(
        `INSERT INTO canvas_info (assignment_id, width, height, user_id, evaluation_time, start_time, end_time) VALUES (?, 0, 0, ?, 0, NULL, NULL)`,
        [assignmentId, userId]
      )
    )
  );
};

// 과제 업데이트 함수
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

// 과제 삭제 (Soft Delete + RESTRICT 검증)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. 과제 존재 확인 (삭제되지 않은 것만)
    const [assignment] = await db.query(
      `SELECT * FROM assignments WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (!assignment.length) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    // 2. RESTRICT 검증: 관련 평가 데이터 존재 확인
    const [responses] = await db.query(
      `SELECT COUNT(*) as count FROM question_responses qr
       JOIN questions q ON qr.question_id = q.id
       WHERE q.assignment_id = ? AND qr.deleted_at IS NULL`,
      [id]
    );

    const [canvasData] = await db.query(
      `SELECT COUNT(*) as count FROM canvas_info
       WHERE assignment_id = ? AND deleted_at IS NULL`,
      [id]
    );

    // 관련 평가 데이터가 있으면 삭제 차단
    if (responses[0].count > 0 || canvasData[0].count > 0) {
      return res.status(409).json({
        message: "평가 데이터가 있어 삭제할 수 없습니다.",
        details: {
          evaluationResponses: responses[0].count,
          canvasRecords: canvasData[0].count
        }
      });
    }

    // 3. 트랜잭션으로 Soft Delete
    await db.withTransaction(async (conn) => {
      // questions soft delete
      await conn.query(
        "UPDATE questions SET deleted_at = NOW() WHERE assignment_id = ? AND deleted_at IS NULL",
        [id]
      );
      // assignment_user soft delete
      await conn.query(
        "UPDATE assignment_user SET deleted_at = NOW() WHERE assignment_id = ? AND deleted_at IS NULL",
        [id]
      );
      // assignment soft delete
      await conn.query(
        "UPDATE assignments SET deleted_at = NOW() WHERE id = ?",
        [id]
      );
    });

    // 4. 실제 파일은 삭제하지 않음 (Soft Delete이므로 복구 가능성 유지)
    // 파일 정리가 필요한 경우 별도의 배치 작업으로 처리

    res.json({ message: "Assignment successfully deleted." });
  } catch (error) {
    handleError(res, "Error deleting assignment", error);
  }
});

// Endpoint to get metadata.json for a given assignment
router.get("/:assignmentId/metadata", authenticateToken, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;

    // Fetch assignment data to get the folder name
    const [questions] = await db.query(
      `SELECT image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL LIMIT 1`,
      [assignmentId]
    );

    if (questions.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const questionImageUrl = questions[0].image;
    const folderName = getFolderNameFromImageUrl(questionImageUrl);

    // metadata.json path
    const metadataPath = path.join(
      __dirname,
      "..",
      "..",
      "assets",
      folderName,
      "metadata.json"
    );

    console.log(`
      metadataPath: ${metadataPath}
      `);

    let metadataJson = null;

    try {
      await fsPromises.access(metadataPath);
      const metadataContent = await fsPromises.readFile(metadataPath, "utf8");
      metadataJson = JSON.parse(metadataContent);
      // Exclude 'userid' key
      delete metadataJson["userid"];
      res.json(metadataJson);
    } catch (err) {
      console.log(err);

      // File not found or other error
      res.status(404).json({ error: "Metadata not found" });
    }
  } catch (error) {
    console.error("Error fetching metadata:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Helper function to get folder name from image URL
function getFolderNameFromImageUrl(imageUrl) {
  const parsedUrl = new URL(imageUrl);
  const pathParts = parsedUrl.pathname.split("/");
  return pathParts[pathParts.length - 2];
}

module.exports = router;
