// assignmentRoutes.js

const express = require("express");
const db = require("../db");
const authenticateToken = require("../jwt");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

const router = express.Router();
// Runtime version marker to verify loaded file
console.log("[assignmentRoutes] Loaded version: 2025-08-21-canvas-id");

const handleError = (res, message, error) => {
  console.error(message, error);
  res.status(500).send(message);
};

// 과제 생성
router.post("/", authenticateToken, async (req, res) => {
  console.log("[/api/assignments] POST 요청 수신:", req.body);
  const {
    title,
    deadline,
    assignment_type,
    selection_type,
    questions,
    users,
    mode,
    cancer_type,
    folder_name,
    is_score,
    is_ai_use,
  } = req.body;

  try {
    console.log("1. assignments 테이블에 삽입 시작...");
    const insertAssignmentQuery = `
      INSERT INTO assignments (title, deadline, assignment_type, selection_type, assignment_mode, cancer_type, folder_name, is_score, is_ai_use)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [assignmentResult] = await db.query(insertAssignmentQuery, [
      title,
      deadline,
      assignment_type,
      selection_type,
      mode,
      cancer_type,
      folder_name,
      is_score,
      is_ai_use,
    ]);
    const assignmentId = assignmentResult.insertId;
    console.log(`2. assignments 테이블 삽입 성공. ID: ${assignmentId}`);

    console.log("3. questions 테이블에 삽입 시작...");
    await Promise.all(
      questions.map(async (question) => {
        const insertQuestionQuery = `
          INSERT INTO questions (assignment_id, image)
          VALUES (?, ?);
        `;
        await db.query(insertQuestionQuery, [assignmentId, question.img]);
      })
    );
    console.log("4. questions 테이블 삽입 성공.");

    console.log("5. assignment_user 테이블에 삽입 시작...");
    await Promise.all(
      users.map(async (userId) => {
        const insertUserQuery = `
          INSERT INTO assignment_user (assignment_id, user_id)
          VALUES (?, ?);
        `;
        await db.query(insertUserQuery, [assignmentId, userId]);
      })
    );
    console.log("6. assignment_user 테이블 삽입 성공.");

    console.log("7. canvas_info 테이블에 삽입 시작...");
    await createCanvasForUsers(assignmentId, users);
    console.log("8. canvas_info 테이블 삽입 성공.");

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
    const folderPath = path.join(__dirname, "..", "..", "assets", assignmentType);
    const jsonPath = path.join(folderPath, jsonSrc);

    // 폴더 존재 여부 확인
    if (!fs.existsSync(folderPath)) {
      console.warn(`Folder does not exist: ${folderPath}`);
      return res.json([]);
    }

    // 파일 존재 여부 확인
    if (!fs.existsSync(jsonPath)) {
      // 파일이 없으면 빈 배열 반환 (프론트는 AI 미표시로 처리)
      return res.json([]);
    }

    const jsonContent = await fsPromises.readFile(jsonPath, "utf8");
    const jsonData = JSON.parse(jsonContent);
    
    // JSON 구조 검증 및 안전한 처리
    if (!jsonData || !jsonData.annotation || !Array.isArray(jsonData.annotation)) {
      console.warn(`Invalid JSON structure in ${jsonPath}:`, jsonData);
      return res.json([]);
    }

    const AI_BBOX = jsonData.annotation.map((annotation) => {
      // annotation 객체와 bbox 배열 검증
      if (!annotation || !annotation.bbox || !Array.isArray(annotation.bbox) || annotation.bbox.length < 2) {
        console.warn(`Invalid annotation structure:`, annotation);
        return null;
      }
      
      const [x, y] = annotation.bbox;
      const score = annotation.score ? annotation.score : 0.6;
      return { x, y, questionIndex: Number(questionIndex), score: score };
    }).filter(Boolean); // null 값 제거

    res.json(AI_BBOX);
  } catch (error) {
    console.error(`Error fetching AI assignment for ${req.query.src}:`, error);
    
    // JSON 파싱 오류나 파일 읽기 오류의 경우 빈 배열 반환
    if (error instanceof SyntaxError || error.code === 'ENOENT') {
      return res.json([]);
    }
    
    // 기타 예상치 못한 오류는 500 반환
    handleError(res, "Error fetching AI assignment", error);
  }
});

// 특정 과제의 AI 데이터 가져오기
router.get("/:assignmentId/ai", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    if (questions.length === 0) {
      return res
        .status(404)
        .json({ message: "No questions found for this assignment." });
    }

  const assignmentType = questions[0].image.split("/").slice(-2)[0];

    const AI_BBOX = [];

    let missingCount = 0;
    questions.forEach((question) => {
      const jsonSrc = question.image
        .split("/")
        .pop()
        .replace(/\.(jpg|png)/, ".json");

      const jsonPath = path.join(__dirname, "..", "..", "assets", assignmentType, jsonSrc);
      if (!fs.existsSync(jsonPath)) {
        missingCount++;
        return;
      }

      try {
        const jsonContent = fs.readFileSync(jsonPath, "utf8");
        if (!jsonContent) return;

        const bbox = JSON.parse(jsonContent).annotation.map((annotation) => {
          const [x, y] = annotation.bbox;
          const score = annotation.score ? annotation.score : 0.6;
          return { x, y, questionIndex: question.id, score: score };
        });
        AI_BBOX.push(...bbox);
      } catch (error) {
        // JSON 파싱 오류 등만 요약 로그
        console.warn("[AI JSON] Failed to parse:", jsonPath);
      }
    });

    if (missingCount > 0) {
      console.warn(`[AI JSON] Missing ${missingCount} json files under assets/${assignmentType}`);
    }

    res.json(AI_BBOX || []);
  } catch (error) {
    handleError(res, "Error fetching AI assignment", error);
  }
});

// 필터 옵션 가져오기 (고유한 Cancer와 Folder 값들)
router.get("/filters", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 사용자가 접근 가능한 과제들의 고유한 cancer_type과 folder_name 가져오기
    const filtersQuery = `
      SELECT DISTINCT 
        a.cancer_type,
        a.folder_name,
        a.assignment_mode
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      WHERE au.user_id = ? AND a.cancer_type IS NOT NULL AND a.folder_name IS NOT NULL
      ORDER BY a.cancer_type, a.folder_name, a.assignment_mode;
    `;
    
    const [filterData] = await db.query(filtersQuery, [userId]);
    
    const cancerTypes = [...new Set(filterData.map(item => item.cancer_type).filter(Boolean))];
    const folderNames = [...new Set(filterData.map(item => item.folder_name).filter(Boolean))];
    const assignmentModes = [...new Set(filterData.map(item => item.assignment_mode).filter(Boolean))];
    
    res.json({
      cancerTypes,
      folderNames,
      assignmentModes
    });
  } catch (error) {
    handleError(res, "Error fetching filter options", error);
  }
});

// 과제 목록 가져오기
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cancer_type, folder_name, assignment_mode } = req.query;
    
    let whereClause = "WHERE au.user_id = ?";
    let queryParams = [userId, userId];
    
    // 필터 조건 추가
    if (cancer_type) {
      whereClause += " AND a.cancer_type = ?";
      queryParams.push(cancer_type);
    }
    if (folder_name) {
      whereClause += " AND a.folder_name = ?";
      queryParams.push(folder_name);
    }
    if (assignment_mode) {
      whereClause += " AND a.assignment_mode = ?";
      queryParams.push(assignment_mode);
    }
    
    const assignmentsQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS CreationDate,
        a.deadline AS dueDate,
        a.cancer_type,
        a.folder_name,
        a.assignment_mode,
        CASE
          WHEN a.deadline >= CURRENT_DATE THEN '진행 중'
          ELSE '완료'
        END AS status,
        (SELECT COUNT(*) FROM questions WHERE assignment_id = a.id) AS total,
        (SELECT COUNT(*) FROM questions q
          JOIN question_responses qr ON q.id = qr.question_id
          WHERE q.assignment_id = a.id AND qr.user_id = ? AND qr.selected_option <> -1) AS completed,
        ci.evaluation_time AS evaluation_time,
        ci.start_time AS start_time,
        ci.end_time AS end_time
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id
      LEFT JOIN canvas_info ci ON ci.assignment_id = a.id AND ci.user_id = au.user_id
      ${whereClause};
    `;

    const [assignments] = await db.query(assignmentsQuery, queryParams);

    const uniqueAssignments = assignments.filter(
      (value, index, self) => index === self.findIndex((t) => t.id === value.id)
    );

    await Promise.all(
      uniqueAssignments.map(async (assignment) => {
        const { id } = assignment;

        const canvasQuery = `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ?;`;
        const [canvas] = await db.query(canvasQuery, [id, userId]);

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
      JOIN assignment_user au ON a.id = au.assignment_id
      JOIN users u ON au.user_id = u.id
      WHERE a.id = ? AND u.id = ?;
    `;
    const [assignment] = await db.query(assignmentQuery, [
      assignmentId,
      userId,
    ]);

    if (assignment.length === 0) {
      return res.status(404).json({ message: "Assignment not found." });
    }

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

    const isInspectedQuery = `SELECT question_id FROM squares_info WHERE user_id = ? AND question_id = ?;`;
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
    // selection_type이 NULL일 수 있으므로 안전 처리
    assignment[0].selectionType = assignment[0].selectionType
      ? assignment[0].selectionType.split(",").map((s) => s.trim())
      : [];

    const canvasQuery = `SELECT id, width, height, lastQuestionIndex, evaluation_time, start_time, end_time FROM canvas_info WHERE assignment_id = ? AND user_id = ?;`; // 수정된 부분
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

    let polygons = [];
    if (canvas.length > 0) {
      console.log("[assignmentRoutes] Fetching polygons by canvas_id", { canvasId: canvas[0].id, userId });
      // polygon_info는 canvas_id를 참조하므로 canvas_id 기준으로 조회
      const polygonsQuery = `SELECT id, coordinates, class_type, question_id as questionIndex FROM polygon_info WHERE canvas_id = ? AND user_id = ?;`;
      const [polygonsResult] = await db.query(polygonsQuery, [canvas[0].id, userId]);
      polygons = polygonsResult.map((p) => ({
        id: p.id,
        points: JSON.parse(p.coordinates),
        class: p.class_type,
        isComplete: true, // DB에서 가져온 폴리곤은 완성 상태로 간주
        questionIndex: p.questionIndex,
      }));
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
      polygons,
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

// 과제 응답 업데이트
router.put("/:assignmentId", authenticateToken, async (req, res) => {
  const assignmentId = req.params.assignmentId;
  const {
    questions,
    beforeCanvas,
    squares,
    polygons,
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

    // Handle polygons (canvas_id 기준으로 관리)
    if (polygons) {
      const deletePolygonsQuery = `DELETE FROM polygon_info WHERE canvas_id = ? AND user_id = ?;`;
      await db.query(deletePolygonsQuery, [beforeCanvas.id, req.user.id]);

      if (polygons.length > 0) {
        const insertPolygonQuery = `
          INSERT INTO polygon_info (question_id, canvas_id, coordinates, class_type, user_id)
          VALUES ?;
        `;
        const polygonValues = polygons.map((p) => [
          p.questionIndex,
          beforeCanvas.id,
          JSON.stringify(p.points),
          p.class,
          req.user.id,
        ]);
        await db.query(insertPolygonQuery, [polygonValues]);
      }
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
    cancer_type,
    folder_name,
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
      cancer_type,
      folder_name,
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
    `SELECT id, image FROM questions WHERE assignment_id = ?`,
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
    `SELECT user_id FROM assignment_user WHERE assignment_id = ?`,
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
    cancer_type,
    folder_name,
    is_score,
    is_ai_use,
  } = params;

  const updateQuery = `
    UPDATE assignments
    SET title = ?, deadline = ?, assignment_type = ?, selection_type = ?, assignment_mode = ?, cancer_type = ?, folder_name = ?, is_score = ?, is_ai_use = ?
    WHERE id = ?;
  `;

  await db.query(updateQuery, [
    title,
    deadline,
    assignment_type,
    selection_type,
    mode,
    cancer_type,
    folder_name,
    is_score,
    is_ai_use,
    assignmentId,
  ]);
};

// 과제 삭제
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
      const folderPath = `./assets/${assignmentType}`;

      try {
        await fsPromises.access(folderPath); // 폴더가 존재하는지 확인
        await fsPromises.rm(folderPath, { recursive: true }); // 폴더를 비동기적으로 삭제
      } catch (error) {
        console.error("Folder does not exist or cannot be removed:", error);
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

// Endpoint to get metadata.json for a given assignment
router.get("/:assignmentId/metadata", authenticateToken, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;

    // Fetch assignment data to get the folder name
    const [questions] = await db.query(
      `SELECT image FROM questions WHERE assignment_id = ? LIMIT 1`,
      [assignmentId]
    );

    if (questions.length === 0) {
      // 과제는 존재하지만 질문이 없거나 접근 불가한 경우: 200 + 빈 객체로 응답하여 프론트 콘솔 404 방지
      return res.json({});
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

    if (process.env.DEBUG === 'true') {
      console.log(`\n      metadataPath: ${metadataPath}\n      `);
    }

  let metadataJson = null;

    try {
      await fsPromises.access(metadataPath);
      const metadataContent = await fsPromises.readFile(metadataPath, "utf8");
      metadataJson = JSON.parse(metadataContent);
      // Exclude 'userid' key
      delete metadataJson["userid"];
      res.json(metadataJson);
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        // 파일이 없으면 200 + 빈 객체로 조용히 응답하여 네트워크 404 경고 제거
        return res.json({});
      }
      if (process.env.DEBUG === 'true') {
        console.warn("[metadata] Error accessing file:", metadataPath, err?.message);
      }
      // 기타 오류는 200 + 빈 객체로 다운그레이드하여 UI를 방해하지 않음
      return res.json({});
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
