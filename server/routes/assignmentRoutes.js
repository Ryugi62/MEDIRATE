// assignmentRoutes.js

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const ExcelJS = require("exceljs"); // 엑셀 파일 생성을 위해 추가

// 에러 핸들링 함수
const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send(message);
};

// 기존 라우트들

// 과제 생성 라우트
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

// AI BBox 데이터 가져오기 라우트
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
      return { x, y, questionIndex: Number(questionIndex) };
    });

    res.json(AI_BBOX);
  } catch (error) {
    handleError(res, "Error fetching AI assignment", error);
  }
});

// 특정 과제의 AI BBox 데이터 가져오기 라우트
router.get("/:assigmentId/ai", authenticateToken, async (req, res) => {
  try {
    const { assigmentId } = req.params;

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
    const [questions] = await db.query(questionsQuery, [assigmentId]);

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
          return { x, y, questionIndex: question.id };
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

// 사용자별 과제 목록 가져오기 라우트
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

        const canvasQuery = `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ?`;
        const [canvas] = await db.query(canvasQuery, [id, userId]);

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

// 특정 과제 상세 정보 가져오기 라우트
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

    const isInpsectedQuery = `SELECT question_id FROM squares_info WHERE user_id = ? AND question_id = ?`;
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

    const canvasQuery = `SELECT id, width, height, lastQuestionIndex FROM canvas_info WHERE assignment_id = ? AND user_id = ?`;
    const [canvas] = await db.query(canvasQuery, [assignmentId, userId]);

    let squares = [];
    if (canvas.length > 0) {
      const squaresQuery = `SELECT id, x, y, question_id as questionIndex, isAI, isTemporary FROM squares_info WHERE canvas_id = ? AND user_id = ?`;
      const [squaresResult] = await db.query(squaresQuery, [
        canvas[0].id,
        userId,
      ]);
      squares = squaresResult;
    }

    // 모든 박스(임시 박스 포함)를 고려하여 점수 계산
    const uniqueQuestionIndex = [
      ...new Set(squares.map((square) => square.questionIndex)),
    ];
    score += uniqueQuestionIndex.length;

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

// 특정 과제 전체 정보 가져오기 라우트
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

// 특정 과제 응답 업데이트 라우트
router.put("/:assignmentId", authenticateToken, async (req, res) => {
  const assignmentId = req.params.assignmentId;
  const { questions, beforeCanvas, squares, lastQuestionIndex } = req.body;

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
        SET width = ?, height = ?, lastQuestionIndex = ?
        WHERE assignment_id = ? AND user_id = ?`;
      await db.query(updateCanvasQuery, [
        beforeCanvas.width,
        beforeCanvas.height,
        lastQuestionIndex,
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
              INSERT INTO squares_info (canvas_id, x, y, question_id, user_id, isAI, isTemporary)
              VALUES (?, ?, ?, ?, ?, ?, ?)`;

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

// 과제 수정 라우트
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

    if (assignmentChanged) {
      await updateQuestions(assignmentId, questions);
    }

    // 유저 업데이트를 마지막에 처리하여 변경사항을 반영
    await updateUserAssignments(assignmentId, users);

    res.json({ message: "Assignment successfully updated." });
  } catch (error) {
    console.error("Error updating assignment:", error);
    res
      .status(500)
      .send({ message: "Failed to update assignment", error: error.message });
  }
});

// 과제 삭제 라우트
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

      console.log(`./assets/${assignmentType}`);

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

// **새로운 다운로드 라우트 추가**
// 다운로드 라우트: 검색된 과제를 엑셀 파일로 다운로드 (TP, FN, FP 포함)
router.post(
  "/download/download-searched-assignments",
  authenticateToken,
  async (req, res) => {
    const { data, sliderValue, scoreValue } = req.body;

    // scoreValue는 1-100 범위, 0.6을 기본값으로 설정
    const scoreThreshold = scoreValue ? scoreValue / 100 : 0.6;

    try {
      // 엑셀 워크북과 워크시트 생성
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignments");

      // 헤더 추가
      worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "제목", key: "title", width: 30 },
        { header: "생성일", key: "createdAt", width: 15 },
        { header: "종료일", key: "endAt", width: 15 },
        { header: "평가자 수", key: "evaluatorCount", width: 15 },
        { header: "답변완료율", key: "answerRate", width: 15 },
        { header: "미답변율", key: "unansweredRate", width: 15 },
        // TP, FN, FP 추가
        { header: "TP", key: "TP", width: 10 },
        { header: "FN", key: "FN", width: 10 },
        { header: "FP", key: "FP", width: 10 },
      ];

      // 각 과제에 대해 TP, FN, FP 계산
      for (const assignment of data) {
        const assignmentId = assignment.id;

        // JSON 파일 경로 설정
        const assignmentType = assignment.assignment_type;
        const jsonPath = path.join(
          __dirname,
          `../assets/${assignmentType}/assignment_${assignmentId}.json`
        );

        let aiBBoxes = [];
        if (fs.existsSync(jsonPath)) {
          const jsonContent = fs.readFileSync(jsonPath, "utf8");
          const parsedJson = JSON.parse(jsonContent);

          aiBBoxes = parsedJson.annotation
            .filter((annotation) => annotation.score >= scoreThreshold)
            .map((annotation) => ({
              x: annotation.bbox[0],
              y: annotation.bbox[1],
            }));
        } else {
          // 초창기 업로드된 과제의 경우 score가 없으므로 기본값 0.6 적용
          // 여기서는 AI BBox 데이터가 데이터베이스에 저장되어 있다고 가정
          const [defaultAIBBoxes] = await db.query(
            `SELECT x, y FROM ai_bboxes WHERE assignment_id = ?`,
            [assignmentId]
          );
          aiBBoxes = defaultAIBBoxes;
        }

        // #인일치 BBox 데이터를 가져옵니다.
        const [matchBBoxes] = await db.query(
          `SELECT x, y FROM match_bboxes WHERE assignment_id = ?`,
          [assignmentId]
        );

        // TP, FP 계산
        let TP = 0;
        let FP = 0;
        let FN = 0;

        aiBBoxes.forEach((aiBox) => {
          const matched = matchBBoxes.some((matchBox) => {
            // 매칭 조건 정의 (예: 좌표 근접성 등)
            // 여기서는 단순히 동일한 x, y 좌표를 가정
            return aiBox.x === matchBox.x && aiBox.y === matchBox.y;
          });
          if (matched) {
            TP++;
          } else {
            FP++;
          }
        });

        // FN은 #인일치 중 AI에 의해 탐지되지 않은 수
        FN = matchBBoxes.length - TP;

        // 워크시트에 행 추가
        worksheet.addRow({
          id: assignment.id,
          title: assignment.title,
          createdAt: assignment.createdAt,
          endAt: assignment.endAt,
          evaluatorCount: assignment.evaluatorCount,
          answerRate: assignment.answerRate,
          unansweredRate: assignment.unansweredRate,
          TP,
          FN,
          FP,
        });
      }

      // 엑셀 파일 스트림 설정
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" + "Assignments.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error generating Excel file:", error);
      res.status(500).send("Failed to generate Excel file.");
    }
  }
);

// **추가된 함수들**

// 할당된 유저에게 캔버스 정보 생성
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

// 과제 업데이트 함수
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

// 질문 업데이트 함수
const updateQuestions = async (assignmentId, questions) => {
  const [existingQuestions] = await db.query(
    `SELECT id, image FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

  const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));

  // 기존 질문을 업데이트 또는 삭제
  await Promise.all(
    existingQuestions.map(async (question) => {
      const updatedQuestion = questions.find((q) => q.id === question.id);
      if (updatedQuestion) {
        // 업데이트가 필요한 질문
        await db.query(`UPDATE questions SET image = ? WHERE id = ?`, [
          updatedQuestion.img,
          question.id,
        ]);
        existingQuestionIds.delete(question.id);
      } else {
        // 삭제가 필요한 질문
        await db.query(`DELETE FROM question_responses WHERE question_id = ?`, [
          question.id,
        ]);
        await db.query(`DELETE FROM questions WHERE id = ?`, [question.id]);
      }
    })
  );

  // 새로 추가된 질문 처리
  const newQuestions = questions.filter((q) => !existingQuestionIds.has(q.id));
  await Promise.all(
    newQuestions.map((question) =>
      db.query(`INSERT INTO questions (assignment_id, image) VALUES (?, ?)`, [
        assignmentId,
        question.img,
      ])
    )
  );
};

// 유저 할당 업데이트 함수
const updateUserAssignments = async (assignmentId, users) => {
  const [existingUsers] = await db.query(
    `SELECT user_id FROM assignment_user WHERE assignment_id = ?`,
    [assignmentId]
  );

  const existingUserIds = new Set(existingUsers.map((u) => u.user_id));

  // 기존 유저를 업데이트 또는 삭제
  await Promise.all(
    existingUsers.map(async (user) => {
      if (!users.includes(user.user_id)) {
        // 삭제가 필요한 유저
        await db.query(
          `DELETE FROM assignment_user WHERE assignment_id = ? AND user_id = ?`,
          [assignmentId, user.user_id]
        );
        await db.query(
          `DELETE FROM canvas_info WHERE assignment_id = ? AND user_id = ?`,
          [assignmentId, user.user_id]
        );
        await db.query(
          `DELETE FROM squares_info WHERE user_id = ? AND canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ?)`,
          [user.user_id, assignmentId]
        );
        await db.query(
          `DELETE FROM question_responses WHERE user_id = ? AND question_id IN (SELECT id FROM questions WHERE assignment_id = ?)`,
          [user.user_id, assignmentId]
        );
      }

      existingUserIds.delete(user.user_id);
    })
  );

  // 새로운 유저 추가
  const newUsers = users.filter((userId) => !existingUserIds.has(userId));
  if (newUsers.length > 0) {
    await Promise.all(
      newUsers.map(async (userId) => {
        const [existingUser] = await db.query(
          `SELECT * FROM assignment_user WHERE assignment_id = ? AND user_id = ?`,
          [assignmentId, userId]
        );
        if (!existingUser.length) {
          await db.query(
            `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
            [assignmentId, userId]
          );
        }
      })
    );
    // 추가된 유저에 대한 캔버스 정보 생성
    await createCanvasForUsers(assignmentId, newUsers);
  }
};

// 질문 응답 및 BBox 삭제 함수
const deleteResponsesAndQuestions = async (assignmentId) => {
  await db.query(
    `DELETE qr FROM question_responses qr JOIN questions q ON qr.question_id = q.id WHERE q.assignment_id = ?`,
    [assignmentId]
  );
  await db.query(`DELETE FROM questions WHERE assignment_id = ?`, [
    assignmentId,
  ]);
};

// 질문 추가 함수
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

// BBox 정보 삭제 함수
const deleteSquareInfo = async (assignmentId) => {
  await db.query(
    `DELETE si FROM squares_info si JOIN canvas_info ci ON si.canvas_id = ci.id WHERE ci.assignment_id = ?`,
    [assignmentId]
  );
};

// **다운로드 라우트**
// 검색된 과제를 엑셀 파일로 다운로드 (TP, FN, FP 포함)
router.post(
  "/download/download-searched-assignments",
  authenticateToken,
  async (req, res) => {
    const { data, sliderValue, scoreValue } = req.body;

    // scoreValue는 1-100 범위, 0.6을 기본값으로 설정
    const scoreThreshold = scoreValue ? scoreValue / 100 : 0.6;

    try {
      // 엑셀 워크북과 워크시트 생성
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignments");

      // 헤더 추가
      worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "제목", key: "title", width: 30 },
        { header: "생성일", key: "createdAt", width: 15 },
        { header: "종료일", key: "endAt", width: 15 },
        { header: "평가자 수", key: "evaluatorCount", width: 15 },
        { header: "답변완료율", key: "answerRate", width: 15 },
        { header: "미답변율", key: "unansweredRate", width: 15 },
        // TP, FN, FP 추가
        { header: "TP", key: "TP", width: 10 },
        { header: "FN", key: "FN", width: 10 },
        { header: "FP", key: "FP", width: 10 },
      ];

      // 각 과제에 대해 TP, FN, FP 계산
      for (const assignment of data) {
        const assignmentId = assignment.id;

        // JSON 파일 경로 설정
        const assignmentType = assignment.assignment_type;
        const jsonPath = path.join(
          __dirname,
          `../assets/${assignmentType}/assignment_${assignmentId}.json`
        );

        let aiBBoxes = [];
        if (fs.existsSync(jsonPath)) {
          const jsonContent = fs.readFileSync(jsonPath, "utf8");
          const parsedJson = JSON.parse(jsonContent);

          aiBBoxes = parsedJson.annotation
            .filter((annotation) => annotation.score >= scoreThreshold)
            .map((annotation) => ({
              x: annotation.bbox[0],
              y: annotation.bbox[1],
            }));
        } else {
          // 초창기 업로드된 과제의 경우 score가 없으므로 기본값 0.6 적용
          // 여기서는 AI BBox 데이터가 데이터베이스에 저장되어 있다고 가정
          const [defaultAIBBoxes] = await db.query(
            `SELECT x, y FROM ai_bboxes WHERE assignment_id = ?`,
            [assignmentId]
          );
          aiBBoxes = defaultAIBBoxes;
        }

        // #인일치 BBox 데이터를 가져옵니다.
        const [matchBBoxes] = await db.query(
          `SELECT x, y FROM match_bboxes WHERE assignment_id = ?`,
          [assignmentId]
        );

        // TP, FP 계산
        let TP = 0;
        let FP = 0;
        let FN = 0;

        aiBBoxes.forEach((aiBox) => {
          const matched = matchBBoxes.some((matchBox) => {
            // 매칭 조건 정의 (예: 좌표 근접성 등)
            // 여기서는 단순히 동일한 x, y 좌표를 가정
            return aiBox.x === matchBox.x && aiBox.y === matchBox.y;
          });
          if (matched) {
            TP++;
          } else {
            FP++;
          }
        });

        // FN은 #인일치 중 AI에 의해 탐지되지 않은 수
        FN = matchBBoxes.length - TP;

        // 워크시트에 행 추가
        worksheet.addRow({
          id: assignment.id,
          title: assignment.title,
          createdAt: assignment.createdAt,
          endAt: assignment.endAt,
          evaluatorCount: assignment.evaluatorCount,
          answerRate: assignment.answerRate,
          unansweredRate: assignment.unansweredRate,
          TP,
          FN,
          FP,
        });
      }

      // 엑셀 파일 스트림 설정
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=" + "Assignments.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error generating Excel file:", error);
      res.status(500).send("Failed to generate Excel file.");
    }
  }
);

// **추가된 라우트 끝**

module.exports = router;
