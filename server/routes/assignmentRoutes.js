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

// 자연 정렬 함수 (파일명의 숫자를 올바르게 정렬)
const naturalSort = (a, b) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// 과제 생성 (트랜잭션 적용)
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
    tags, // 태그 이름 배열 ["brst", "pilot-01", ...]
    project_id,
    cancer_type_id,
  } = req.body;

  try {
    // Convert ISO 8601 datetime to MySQL DATE format (YYYY-MM-DD)
    const formattedDeadline = deadline ? new Date(deadline).toISOString().split('T')[0] : null;

    // 트랜잭션으로 원자성 보장 - 부분 실패 시 전체 롤백
    const assignmentId = await db.withTransaction(async (conn) => {
      // 1. 과제 생성
      const insertAssignmentQuery = `
        INSERT INTO assignments (title, deadline, assignment_type, selection_type, assignment_mode, is_score, is_ai_use, project_id, cancer_type_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      const [assignmentResult] = await conn.query(insertAssignmentQuery, [
        title,
        formattedDeadline,
        assignment_type,
        selection_type,
        mode,
        is_score,
        is_ai_use,
        project_id || null,
        cancer_type_id || null,
      ]);
      const newAssignmentId = assignmentResult.insertId;

      // 2. 질문(이미지) 삽입
      for (const question of questions) {
        await conn.query(
          `INSERT INTO questions (assignment_id, image) VALUES (?, ?)`,
          [newAssignmentId, question.img]
        );
      }

      // 3. 사용자 할당
      for (const userId of users) {
        await conn.query(
          `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
          [newAssignmentId, userId]
        );
      }

      // 4. 캔버스 생성
      for (const userId of users) {
        await conn.query(
          `INSERT INTO canvas_info (assignment_id, width, height, user_id, evaluation_time, start_time, end_time)
           VALUES (?, 0, 0, ?, 0, NULL, NULL)`,
          [newAssignmentId, userId]
        );
      }

      // 5. 태그 처리
      if (tags && tags.length > 0) {
        await saveAssignmentTagsWithConn(newAssignmentId, tags, conn);
      }

      return newAssignmentId;
    });

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

    const parsed = JSON.parse(jsonContent);
    const annotations = parsed.annotation;

    // annotation이 없거나 배열이 아닌 경우 빈 배열 반환
    if (!annotations || !Array.isArray(annotations)) {
      return res.json([]);
    }

    const AI_BBOX = annotations
      .map((annotation) => {
        const [x, y] = annotation.bbox;
        const score = annotation.score ? annotation.score : 0.6;
        // 좌표 유효성 검증 (음수 값을 0으로 변환)
        const validX = Math.max(0, Number(x) || 0);
        const validY = Math.max(0, Number(y) || 0);
        return { x: validX, y: validY, questionIndex: Number(questionIndex), score: score };
      })
      .filter((item) => item.x >= 0 && item.y >= 0); // 유효하지 않은 좌표 필터링

    res.json(AI_BBOX);
  } catch (error) {
    // 파일이 없거나 읽기 오류 시 빈 배열 반환
    console.error("AI data fetch error:", error.message);
    res.json([]);
  }
});

// 특정 과제의 AI 데이터 가져오기
router.get("/:assignmentId/ai", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // DB에서 assignment_type 가져오기
    const assignmentQuery = `SELECT assignment_type FROM assignments WHERE id = ?;`;
    const [assignmentResult] = await db.query(assignmentQuery, [assignmentId]);

    if (assignmentResult.length === 0) {
      return res.status(404).json({ message: "Assignment not found." });
    }

    const assignmentType = assignmentResult[0].assignment_type;

    const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL;`;
    const [questions] = await db.query(questionsQuery, [assignmentId]);

    if (questions.length === 0) {
      return res
        .status(404)
        .json({ message: "No questions found for this assignment." });
    }

    // 이미지 파일명 기준 자연 정렬
    questions.sort((a, b) => naturalSort(a.image, b.image));

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

// 페이지네이션 지원 과제 목록 API
router.get("/paginated", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 15,
      search = "",
      mode = "all",
      tag = "all",
      status = "all",
      sortBy = "id",
      sortDir = "desc",
      projectId = null,
      cancerId = null,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // WHERE 조건 구성
    let whereConditions = ["a.deleted_at IS NULL", "au.user_id = ?"];
    let params = [userId];

    if (search) {
      whereConditions.push("a.title LIKE ?");
      params.push(`${search}%`);
    }

    if (mode !== "all") {
      whereConditions.push("a.assignment_mode = ?");
      params.push(mode);
    }

    if (tag !== "all") {
      whereConditions.push(`
        EXISTS (
          SELECT 1 FROM assignment_tags at2
          JOIN tags t2 ON at2.tag_id = t2.id
          WHERE at2.assignment_id = a.id AND t2.name = ? AND t2.deleted_at IS NULL
        )
      `);
      params.push(tag);
    }

    if (status !== "all") {
      if (status === "진행 중") {
        whereConditions.push("a.deadline >= CURRENT_DATE");
      } else if (status === "완료") {
        whereConditions.push("a.deadline < CURRENT_DATE");
      }
    }

    // 프로젝트 필터
    if (projectId && projectId !== "null") {
      if (projectId === "unclassified") {
        whereConditions.push("a.project_id IS NULL");
      } else {
        whereConditions.push("a.project_id = ?");
        params.push(parseInt(projectId));
      }
    }

    // 암종 필터
    if (cancerId && cancerId !== "null") {
      if (cancerId === "unclassified") {
        whereConditions.push("a.cancer_type_id IS NULL");
      } else {
        whereConditions.push("a.cancer_type_id = ?");
        params.push(parseInt(cancerId));
      }
    }

    const whereClause = whereConditions.join(" AND ");

    // 정렬 컬럼 매핑
    const sortColumnMap = {
      id: "a.id",
      title: "a.title",
      mode: "a.assignment_mode",
      createdAt: "a.creation_date",
      dueDate: "a.deadline",
      status: "a.deadline",
    };
    const sortColumn = sortColumnMap[sortBy] || "a.id";
    const sortDirection = sortDir === "up" ? "ASC" : "DESC";

    // 전체 개수 조회
    const [countResult] = await db.query(
      `SELECT COUNT(DISTINCT a.id) as total
       FROM assignments a
       JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
       WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 페이지네이션된 데이터 조회
    const [assignments] = await db.query(
      `SELECT
        a.id,
        a.title,
        a.creation_date AS CreationDate,
        a.deadline AS dueDate,
        a.assignment_mode AS assignmentMode,
        CASE
          WHEN a.deadline >= CURRENT_DATE THEN '진행 중'
          ELSE '완료'
        END AS status,
        (SELECT COUNT(*) FROM questions WHERE assignment_id = a.id AND deleted_at IS NULL) AS total,
        MAX(ci.evaluation_time) AS evaluation_time,
        MAX(ci.start_time) AS start_time,
        MAX(ci.end_time) AS end_time
       FROM assignments a
       JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
       LEFT JOIN canvas_info ci ON ci.assignment_id = a.id AND ci.user_id = ? AND ci.deleted_at IS NULL
       WHERE ${whereClause}
       GROUP BY a.id, a.title, a.creation_date, a.deadline, a.assignment_mode
       ORDER BY ${sortColumn} ${sortDirection}
       LIMIT ? OFFSET ?`,
      [userId, ...params, limitNum, offset]
    );

    // 각 과제의 완료 수, 태그 조회
    for (const assignment of assignments) {
      const { id } = assignment;

      // 완료 수 계산 (TextBox 모드)
      const [completedResult] = await db.query(
        `SELECT COUNT(*) as count FROM questions q
         JOIN question_responses qr ON q.id = qr.question_id
         WHERE q.assignment_id = ? AND qr.user_id = ? AND qr.selected_option <> -1
         AND q.deleted_at IS NULL AND qr.deleted_at IS NULL`,
        [id, userId]
      );
      assignment.completed = completedResult[0].count;

      // BBox/Segment 모드 완료 수 추가
      const [canvas] = await db.query(
        `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [id, userId]
      );

      if (canvas.length > 0) {
        const [squares] = await db.query(
          `SELECT DISTINCT question_id
           FROM squares_info
           WHERE canvas_id IN (SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL)
           AND deleted_at IS NULL`,
          [id, userId]
        );
        assignment.completed += squares.length;
      }

      // 태그 조회
      const [tags] = await db.query(
        `SELECT t.id, t.name, t.color
         FROM tags t
         JOIN assignment_tags at ON t.id = at.tag_id
         WHERE at.assignment_id = ? AND t.deleted_at IS NULL`,
        [id]
      );
      assignment.tags = tags;
    }

    // 전체 태그 목록 (필터용)
    const [allTags] = await db.query(`
      SELECT t.name, COUNT(at.assignment_id) as count
      FROM tags t
      JOIN assignment_tags at ON t.id = at.tag_id
      JOIN assignments a ON at.assignment_id = a.id AND a.deleted_at IS NULL
      JOIN assignment_user au ON a.id = au.assignment_id AND au.user_id = ? AND au.deleted_at IS NULL
      WHERE t.deleted_at IS NULL
      GROUP BY t.id
      ORDER BY count DESC
    `, [userId]);

    res.json({
      data: assignments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      allTags,
    });
  } catch (error) {
    console.error("Failed to fetch paginated assignments:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 과제 목록 가져오기 (기존 API - 하위 호환성 유지)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const assignmentsQuery = `
      SELECT
        a.id,
        a.title,
        a.creation_date AS CreationDate,
        a.deadline AS dueDate,
        a.assignment_mode AS assignmentMode,
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

        // 태그 조회
        const [tags] = await db.query(
          `SELECT t.id, t.name, t.color
           FROM tags t
           JOIN assignment_tags at ON t.id = at.tag_id
           WHERE at.assignment_id = ? AND t.deleted_at IS NULL`,
          [id]
        );
        assignment.tags = tags;
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
        a.is_ai_use,
        p.name AS projectName,
        ct.name_ko AS cancerTypeName
      FROM assignments a
      JOIN assignment_user au ON a.id = au.assignment_id AND au.deleted_at IS NULL
      JOIN users u ON au.user_id = u.id AND u.deleted_at IS NULL
      LEFT JOIN projects p ON a.project_id = p.id AND p.deleted_at IS NULL
      LEFT JOIN cancer_types ct ON a.cancer_type_id = ct.id AND ct.deleted_at IS NULL
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

    // 이미지 파일명 기준 자연 정렬
    questions.sort((a, b) => naturalSort(a.image, b.image));

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
    let polygons = [];
    if (canvas.length > 0) {
      const squaresQuery = `SELECT id, x, y, question_id as questionIndex, isAI, isTemporary FROM squares_info WHERE canvas_id = ? AND user_id = ? AND deleted_at IS NULL;`;
      const [squaresResult] = await db.query(squaresQuery, [
        canvas[0].id,
        userId,
      ]);
      squares = squaresResult;

      // Segment 모드용 polygon 로드
      const polygonsQuery = `SELECT id, question_id as questionIndex, coordinates, class_type as classType, isAI, isTemporary FROM polygon_info WHERE canvas_id = ? AND user_id = ?;`;
      const [polygonsResult] = await db.query(polygonsQuery, [
        canvas[0].id,
        userId,
      ]);
      // coordinates를 JSON 파싱하여 points로 변환
      polygons = polygonsResult.map(polygon => {
        const coordData = JSON.parse(polygon.coordinates);
        // 기존 데이터 호환성: coordData가 배열이면 그대로, 객체이면 points 추출
        const points = Array.isArray(coordData) ? coordData : (coordData.points || []);
        return {
          ...polygon,
          points: points,
        };
      });
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
      polygons,  // Segment 모드용
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
        a.is_ai_use,
        a.project_id,
        a.cancer_type_id
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

    // 이미지 파일명 기준 자연 정렬
    questions.sort((a, b) => naturalSort(a.image, b.image));

    // 태그 조회
    const [tags] = await db.query(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN assignment_tags at ON t.id = at.tag_id
       WHERE at.assignment_id = ? AND t.deleted_at IS NULL`,
      [assignmentId]
    );

    const transformedAssignmentDetails = {
      id: assignment.id,
      title: assignment.title,
      assigment_mode: assignment.mode,
      is_score: assignment.is_score,
      is_ai_use: assignment.is_ai_use,
      deadline: assignment.deadline,
      selectedAssignmentId: assignment.selectedAssignmentId,
      selectedAssignmentType: assignment.selectedAssignmentType,
      project_id: assignment.project_id,
      cancer_type_id: assignment.cancer_type_id,
      tags: tags, // 태그 배열 [{id, name, color}, ...]
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
    polygons,  // Segment 모드용
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

    // Segment 모드용 polygon 저장
    if (polygons && polygons.length > 0) {
      // 기존 polygon 삭제
      const deletePolygonsQuery = `DELETE FROM polygon_info WHERE canvas_id = ? AND user_id = ?;`;
      await db.query(deletePolygonsQuery, [beforeCanvas.id, req.user.id]);

      // 새 polygon 삽입
      await Promise.all(
        polygons.map(async (polygon) => {
          const insertPolygonQuery = `
              INSERT INTO polygon_info (canvas_id, question_id, coordinates, class_type, user_id, isAI, isTemporary)
              VALUES (?, ?, ?, ?, ?, ?, ?);
          `;

          await db.query(insertPolygonQuery, [
            beforeCanvas.id,
            polygon.questionIndex,
            JSON.stringify(polygon.points),  // points를 JSON으로 저장
            polygon.classType || 'Tumor',
            req.user.id,
            polygon.isAI ? 1 : 0,
            polygon.isTemporary ? 1 : 0,
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
    tags, // 태그 이름 배열
    project_id,
    cancer_type_id,
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
      project_id,
      cancer_type_id,
    });

    // 태그 업데이트
    if (tags !== undefined) {
      await saveAssignmentTags(assignmentId, tags || []);
    }

    await updateQuestions(assignmentId, questions);

    await updateUserAssignments(assignmentId, users);

    res.json({ message: "Assignment successfully updated." });
  } catch (error) {
    console.error("Error updating assignment:", error);
    console.error("Error stack:", error.stack);
    res
      .status(500)
      .send({ message: "Failed to update assignment", error: error.message || String(error) });
  }
});

// 과제 질문 업데이트 함수
const updateQuestions = async (assignmentId, questions) => {
  // questions가 undefined/null인 경우 빈 배열로 처리
  const safeQuestions = Array.isArray(questions) ? questions : [];

  const [existingQuestions] = await db.query(
    `SELECT id, image FROM questions WHERE assignment_id = ? AND deleted_at IS NULL`,
    [assignmentId]
  );

  const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));
  const submittedQuestionIds = new Set(safeQuestions.map((q) => q.id));

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
    safeQuestions.map(async (question) => {
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

// 과제 사용자 할당 업데이트 함수 (Soft Delete 적용)
const updateUserAssignments = async (assignmentId, users, performedBy = null) => {
  // users가 undefined/null인 경우 빈 배열로 처리
  const safeUsers = Array.isArray(users) ? users : [];

  const [existingUsers] = await db.query(
    `SELECT user_id FROM assignment_user WHERE assignment_id = ? AND deleted_at IS NULL`,
    [assignmentId]
  );

  const existingUserIds = new Set(existingUsers.map((u) => u.user_id));

  const usersToRemove = [...existingUserIds].filter(
    (userId) => !safeUsers.includes(userId)
  );
  const usersToAdd = safeUsers.filter((userId) => !existingUserIds.has(userId));

  // 트랜잭션으로 원자성 보장
  await db.withTransaction(async (conn) => {
    // 1. 할당 해제될 사용자 처리 (Soft Delete)
    for (const userId of usersToRemove) {
      // 1-1. canvas_id 먼저 조회 (삭제 전에 조회해야 함)
      const [canvasRows] = await conn.query(
        `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [assignmentId, userId]
      );
      const canvasIds = canvasRows.map((r) => r.id);

      // 1-2. squares_info soft delete (자식 테이블 먼저)
      if (canvasIds.length > 0) {
        await conn.query(
          `UPDATE squares_info SET deleted_at = NOW() WHERE canvas_id IN (?) AND deleted_at IS NULL`,
          [canvasIds]
        );

        // 1-2b. polygon_info soft delete (Segment 모드용)
        await conn.query(
          `UPDATE polygon_info SET deleted_at = NOW() WHERE canvas_id IN (?) AND deleted_at IS NULL`,
          [canvasIds]
        );
      }

      // 1-3. question_responses soft delete
      await conn.query(
        `UPDATE question_responses SET deleted_at = NOW()
         WHERE user_id = ? AND deleted_at IS NULL
         AND question_id IN (SELECT id FROM questions WHERE assignment_id = ?)`,
        [userId, assignmentId]
      );

      // 1-4. canvas_info soft delete
      await conn.query(
        `UPDATE canvas_info SET deleted_at = NOW() WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [assignmentId, userId]
      );

      // 1-5. assignment_user soft delete
      await conn.query(
        `UPDATE assignment_user SET deleted_at = NOW() WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [assignmentId, userId]
      );

      // 1-6. 이력 기록 (performedBy가 있을 경우)
      if (performedBy) {
        await conn.query(
          `INSERT INTO assignment_user_history (assignment_id, user_id, action, performed_by)
           VALUES (?, ?, 'UNASSIGN', ?)`,
          [assignmentId, userId, performedBy]
        );
      }
    }

    // 2. 새로운 사용자 할당
    for (const userId of usersToAdd) {
      // 기존에 soft delete된 레코드가 있으면 복원, 없으면 새로 생성
      const [existingAssignment] = await conn.query(
        `SELECT * FROM assignment_user WHERE assignment_id = ? AND user_id = ?`,
        [assignmentId, userId]
      );

      if (existingAssignment.length > 0) {
        // 복원
        await conn.query(
          `UPDATE assignment_user SET deleted_at = NULL WHERE assignment_id = ? AND user_id = ?`,
          [assignmentId, userId]
        );
      } else {
        // 새로 생성
        await conn.query(
          `INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)`,
          [assignmentId, userId]
        );
      }

      // 캔버스도 복원 또는 생성
      const [existingCanvas] = await conn.query(
        `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ?`,
        [assignmentId, userId]
      );

      if (existingCanvas.length > 0) {
        // 복원
        await conn.query(
          `UPDATE canvas_info SET deleted_at = NULL WHERE assignment_id = ? AND user_id = ?`,
          [assignmentId, userId]
        );
      } else {
        // 새로 생성
        await conn.query(
          `INSERT INTO canvas_info (assignment_id, width, height, user_id, evaluation_time, start_time, end_time)
           VALUES (?, 0, 0, ?, 0, NULL, NULL)`,
          [assignmentId, userId]
        );
      }

      // 이력 기록
      if (performedBy) {
        await conn.query(
          `INSERT INTO assignment_user_history (assignment_id, user_id, action, performed_by)
           VALUES (?, ?, 'ASSIGN', ?)`,
          [assignmentId, userId, performedBy]
        );
      }
    }
  });
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
    project_id,
    cancer_type_id,
  } = params;

  console.log("[DEBUG] updateAssignment - mode received:", mode);
  console.log("[DEBUG] updateAssignment - all params:", JSON.stringify(params, null, 2));

  // Fetch existing assignment to preserve values not provided
  const [existingRows] = await db.query(
    `SELECT assignment_type, selection_type, assignment_mode FROM assignments WHERE id = ?`,
    [assignmentId]
  );
  const existing = existingRows[0] || {};

  // Convert ISO 8601 datetime to MySQL DATE format (YYYY-MM-DD)
  const formattedDeadline = deadline ? new Date(deadline).toISOString().split('T')[0] : null;

  // Use provided values or fall back to existing values
  const finalAssignmentType = assignment_type !== undefined ? assignment_type : existing.assignment_type;
  const finalSelectionType = selection_type !== undefined ? selection_type : existing.selection_type;
  const finalMode = mode !== undefined ? mode : existing.assignment_mode;

  const updateQuery = `
    UPDATE assignments
    SET title = ?, deadline = ?, assignment_type = ?, selection_type = ?, assignment_mode = ?, is_score = ?, is_ai_use = ?, project_id = ?, cancer_type_id = ?
    WHERE id = ?;
  `;

  const result = await db.query(updateQuery, [
    title,
    formattedDeadline,
    finalAssignmentType,
    finalSelectionType,
    finalMode,
    is_score,
    is_ai_use,
    project_id || null,
    cancer_type_id || null,
    assignmentId,
  ]);

  console.log("[DEBUG] updateAssignment - query result:", JSON.stringify(result, null, 2));
};

// 과제 태그 저장 함수
// 트랜잭션 커넥션을 받는 태그 저장 함수 (과제 생성 시 사용)
const saveAssignmentTagsWithConn = async (assignmentId, tagNames, conn) => {
  // 기존 태그 연결 삭제
  await conn.query(`DELETE FROM assignment_tags WHERE assignment_id = ?`, [
    assignmentId,
  ]);

  if (!tagNames || tagNames.length === 0) return;

  // 태그 생성/조회 및 연결
  for (const name of tagNames) {
    const tagName = name.trim().toLowerCase().replace(/^#/, "");
    if (!tagName) continue;

    // 태그 존재 확인 또는 생성
    let tagId;
    const [existing] = await conn.query(
      `SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL`,
      [tagName]
    );

    if (existing.length > 0) {
      tagId = existing[0].id;
    } else {
      const [insertResult] = await conn.query(
        `INSERT INTO tags (name) VALUES (?)`,
        [tagName]
      );
      tagId = insertResult.insertId;
    }

    // 연결 생성
    await conn.query(
      `INSERT INTO assignment_tags (assignment_id, tag_id) VALUES (?, ?)`,
      [assignmentId, tagId]
    );
  }
};

// 기존 함수 유지 (과제 업데이트 등에서 사용)
const saveAssignmentTags = async (assignmentId, tagNames) => {
  // 기존 태그 연결 삭제
  await db.query(`DELETE FROM assignment_tags WHERE assignment_id = ?`, [
    assignmentId,
  ]);

  if (!tagNames || tagNames.length === 0) return;

  // 태그 생성/조회 및 연결
  for (const name of tagNames) {
    const tagName = name.trim().toLowerCase().replace(/^#/, "");
    if (!tagName) continue;

    // 태그 존재 확인 또는 생성
    let tagId;
    const [existing] = await db.query(
      `SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL`,
      [tagName]
    );

    if (existing.length > 0) {
      tagId = existing[0].id;
    } else {
      const [insertResult] = await db.query(
        `INSERT INTO tags (name) VALUES (?)`,
        [tagName]
      );
      tagId = insertResult.insertId;
    }

    // 연결 생성
    await db.query(
      `INSERT INTO assignment_tags (assignment_id, tag_id) VALUES (?, ?)`,
      [assignmentId, tagId]
    );
  }
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

// 평가자 복구 API (Soft Delete된 평가자와 평가 데이터 복구)
router.post("/:assignmentId/restore-evaluator/:userId", authenticateToken, async (req, res) => {
  // 관리자만 복구 가능
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

  const { assignmentId, userId } = req.params;
  const performedBy = req.user.id;

  try {
    // 1. 과제 존재 확인
    const [assignment] = await db.query(
      `SELECT * FROM assignments WHERE id = ? AND deleted_at IS NULL`,
      [assignmentId]
    );

    if (!assignment.length) {
      return res.status(404).json({ message: "과제를 찾을 수 없습니다." });
    }

    // 2. 사용자 존재 확인
    const [user] = await db.query(
      `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );

    if (!user.length) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    // 3. 복구할 데이터 확인 (soft delete된 레코드가 있는지)
    const [deletedAssignment] = await db.query(
      `SELECT * FROM assignment_user WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [assignmentId, userId]
    );

    if (!deletedAssignment.length) {
      return res.status(404).json({ message: "복구할 데이터가 없습니다. 이 평가자는 삭제되지 않았거나 할당된 적이 없습니다." });
    }

    // 4. 트랜잭션으로 복구 실행
    await db.withTransaction(async (conn) => {
      // 4-1. assignment_user 복구
      await conn.query(
        `UPDATE assignment_user SET deleted_at = NULL WHERE assignment_id = ? AND user_id = ?`,
        [assignmentId, userId]
      );

      // 4-2. canvas_info 복구
      await conn.query(
        `UPDATE canvas_info SET deleted_at = NULL WHERE assignment_id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
        [assignmentId, userId]
      );

      // 4-3. canvas_id 조회 (복구된 캔버스)
      const [canvasRows] = await conn.query(
        `SELECT id FROM canvas_info WHERE assignment_id = ? AND user_id = ?`,
        [assignmentId, userId]
      );
      const canvasIds = canvasRows.map((r) => r.id);

      if (canvasIds.length > 0) {
        // 4-4. squares_info 복구
        await conn.query(
          `UPDATE squares_info SET deleted_at = NULL WHERE canvas_id IN (?) AND deleted_at IS NOT NULL`,
          [canvasIds]
        );

        // 4-5. polygon_info 복구 (Segment 모드)
        await conn.query(
          `UPDATE polygon_info SET deleted_at = NULL WHERE canvas_id IN (?) AND deleted_at IS NOT NULL`,
          [canvasIds]
        );
      }

      // 4-6. question_responses 복구
      await conn.query(
        `UPDATE question_responses SET deleted_at = NULL
         WHERE user_id = ? AND deleted_at IS NOT NULL
         AND question_id IN (SELECT id FROM questions WHERE assignment_id = ?)`,
        [userId, assignmentId]
      );

      // 4-7. 이력 기록
      await conn.query(
        `INSERT INTO assignment_user_history (assignment_id, user_id, action, performed_by)
         VALUES (?, ?, 'ASSIGN', ?)`,
        [assignmentId, userId, performedBy]
      );
    });

    res.json({
      message: "평가자가 성공적으로 복구되었습니다.",
      assignmentId: parseInt(assignmentId),
      userId: parseInt(userId)
    });
  } catch (error) {
    console.error("Error restoring evaluator:", error);
    res.status(500).json({ message: "평가자 복구 중 오류가 발생했습니다.", error: error.message });
  }
});

// 평가자 할당 이력 조회 API
router.get("/:assignmentId/evaluator-history", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;

  try {
    // 과제 존재 확인
    const [assignment] = await db.query(
      `SELECT * FROM assignments WHERE id = ? AND deleted_at IS NULL`,
      [assignmentId]
    );

    if (!assignment.length) {
      return res.status(404).json({ message: "과제를 찾을 수 없습니다." });
    }

    // 이력 조회 (최신순)
    const [history] = await db.query(
      `SELECT
        h.id,
        h.assignment_id,
        h.user_id,
        u.username AS user_username,
        u.realname AS user_realname,
        h.action,
        h.performed_by,
        p.username AS performer_username,
        p.realname AS performer_realname,
        h.performed_at
       FROM assignment_user_history h
       LEFT JOIN users u ON h.user_id = u.id
       LEFT JOIN users p ON h.performed_by = p.id
       WHERE h.assignment_id = ?
       ORDER BY h.performed_at DESC`,
      [assignmentId]
    );

    res.json(history);
  } catch (error) {
    console.error("Error fetching evaluator history:", error);
    res.status(500).json({ message: "이력 조회 중 오류가 발생했습니다.", error: error.message });
  }
});

// 삭제된 평가자 목록 조회 API (복구 가능한 평가자)
router.get("/:assignmentId/deleted-evaluators", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;

  try {
    // 과제 존재 확인
    const [assignment] = await db.query(
      `SELECT * FROM assignments WHERE id = ? AND deleted_at IS NULL`,
      [assignmentId]
    );

    if (!assignment.length) {
      return res.status(404).json({ message: "과제를 찾을 수 없습니다." });
    }

    // 삭제된 평가자 목록 (복구 가능)
    const [deletedEvaluators] = await db.query(
      `SELECT
        au.user_id,
        u.username,
        u.realname,
        au.deleted_at,
        (SELECT COUNT(*) FROM canvas_info ci WHERE ci.assignment_id = au.assignment_id AND ci.user_id = au.user_id) AS has_canvas,
        (SELECT COUNT(*) FROM question_responses qr
         WHERE qr.user_id = au.user_id
         AND qr.question_id IN (SELECT id FROM questions WHERE assignment_id = au.assignment_id)) AS response_count
       FROM assignment_user au
       JOIN users u ON au.user_id = u.id
       WHERE au.assignment_id = ? AND au.deleted_at IS NOT NULL AND u.deleted_at IS NULL
       ORDER BY au.deleted_at DESC`,
      [assignmentId]
    );

    res.json(deletedEvaluators);
  } catch (error) {
    console.error("Error fetching deleted evaluators:", error);
    res.status(500).json({ message: "삭제된 평가자 조회 중 오류가 발생했습니다.", error: error.message });
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
