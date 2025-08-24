const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../jwt");

// 날짜 및 시간 형식 변환 함수 (YYYY-MM-DD HH:MM:SS)
const formatDateTime = (date) => {
  // 화면 표준: 유효하지 않은 날짜는 'N/A' 대신 '-'로 표기
  if (!date || isNaN(new Date(date))) return "-";
  const d = new Date(date);
  return (
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2) +
    " " +
    ("0" + d.getHours()).slice(-2) +
    ":" +
    ("0" + d.getMinutes()).slice(-2) +
    ":" +
    ("0" + d.getSeconds()).slice(-2)
  );
};

// 비율 계산 함수
const calculateRates = (answered, total) => {
  if (total === 0) return "0.00%";
  const rate = (answered / total) * 100;
  return `${rate.toFixed(2)}%`;
};

router.get("/", async (req, res) => {
  try {
    const { assignment_mode, cancer_type, folder_name } = req.query;

    let whereClauses = [];
    let queryParams = [];

    if (assignment_mode) {
      whereClauses.push("a.assignment_mode = ?");
      queryParams.push(assignment_mode);
    }
    if (cancer_type) {
      whereClauses.push("a.cancer_type = ?");
      queryParams.push(cancer_type);
    }
    if (folder_name) {
      whereClauses.push("a.folder_name = ?");
      queryParams.push(folder_name);
    }

    const whereClause = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // 단일 쿼리로 모든 데이터 가져오기 (N+1 문제 해결)
    const optimizedQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS createdAt,
        a.cancer_type,
        a.folder_name,
        a.assignment_mode AS assignmentMode,
        ci_stats.endAt,
        ci_stats.duration,
        COALESCE(au_count.evaluatorCount, 0) AS evaluatorCount,
        COALESCE(q_count.totalQuestions, 0) AS totalQuestions,
        COALESCE(
          CASE 
            WHEN a.assignment_mode = 'BBox' THEN bbox_answers.answeredQuestions
            WHEN a.assignment_mode = 'Polygon' THEN polygon_answers.answeredQuestions
            ELSE text_answers.answeredQuestions
          END, 0
        ) AS answeredQuestions
      FROM assignments a
      
      LEFT JOIN (
        SELECT 
          assignment_id,
          MAX(end_time) as endAt,
          SUM(evaluation_time) as duration
        FROM canvas_info 
        GROUP BY assignment_id
      ) ci_stats ON a.id = ci_stats.assignment_id
      
      LEFT JOIN (
        SELECT assignment_id, COUNT(DISTINCT user_id) AS evaluatorCount
        FROM assignment_user 
        GROUP BY assignment_id
      ) au_count ON a.id = au_count.assignment_id
      
      LEFT JOIN (
        SELECT assignment_id, COUNT(*) AS totalQuestions
        FROM questions 
        GROUP BY assignment_id
      ) q_count ON a.id = q_count.assignment_id
      
      LEFT JOIN (
        SELECT 
          q.assignment_id,
          COUNT(DISTINCT CONCAT(si.user_id, '-', q.id)) AS answeredQuestions
        FROM questions q
        JOIN squares_info si ON q.id = si.question_id
        GROUP BY q.assignment_id
      ) bbox_answers ON a.id = bbox_answers.assignment_id AND a.assignment_mode = 'BBox'
      
      LEFT JOIN (
        SELECT 
          q.assignment_id,
          COUNT(DISTINCT CONCAT(pi.user_id, '-', q.id)) AS answeredQuestions
        FROM questions q
        JOIN polygon_info pi ON q.id = pi.question_id
        GROUP BY q.assignment_id
      ) polygon_answers ON a.id = polygon_answers.assignment_id AND a.assignment_mode = 'Polygon'
      
      LEFT JOIN (
        SELECT 
          q.assignment_id,
          COUNT(*) AS answeredQuestions
        FROM question_responses qr
        JOIN questions q ON qr.question_id = q.id
        WHERE qr.selected_option >= 0
        GROUP BY q.assignment_id
      ) text_answers ON a.id = text_answers.assignment_id AND a.assignment_mode NOT IN ('BBox', 'Polygon')
      
      ${whereClause}
      ORDER BY a.id DESC
    `;

    const [assignments] = await db.query(optimizedQuery, queryParams);

    // 단일 루프에서 계산 및 포맷팅 처리
    assignments.forEach(assignment => {
      const totalPossibleAnswers = assignment.totalQuestions * assignment.evaluatorCount;
      
      assignment.answerRate = calculateRates(assignment.answeredQuestions, totalPossibleAnswers);
      assignment.unansweredRate = calculateRates(totalPossibleAnswers - assignment.answeredQuestions, totalPossibleAnswers);
      assignment.createdAt = formatDateTime(assignment.createdAt);
      assignment.endAt = formatDateTime(assignment.endAt);
    });

    res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/:assignmentId", authenticateToken, async (req, res) => {
  const { assignmentId } = req.params;
  try {
    const [[{ assignment_mode }]] = await db.query(
      `SELECT assignment_mode FROM assignments WHERE id = ?`,
      [assignmentId]
    );

    const [usersData] = await db.query(
      `SELECT u.username AS name, q.id AS questionId, q.image AS questionImage, u.id AS userId, a.title As FileName,
       COALESCE(qr.selected_option, -1) AS originalSelection, COUNT(DISTINCT si.id) AS squareCount
       FROM users u
       JOIN assignment_user au ON u.id = au.user_id
       JOIN assignments a ON au.assignment_id = a.id
       LEFT JOIN questions q ON au.assignment_id = q.assignment_id
       LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.user_id = u.id
       LEFT JOIN squares_info si ON q.id = si.question_id AND si.user_id = u.id
       WHERE au.assignment_id = ?
       GROUP BY u.id, q.id`,
      [assignmentId]
    );

    const fetchData = async (query, params) => {
      const [data] = await db.query(query, params);
      return data;
    };

    const squaresData =
      assignment_mode === "BBox"
        ? await fetchData(
            `SELECT DISTINCT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
             FROM (
               SELECT question_id, x, y, user_id, isAI, isTemporary,
                      ROW_NUMBER() OVER (PARTITION BY question_id, x, y, user_id ORDER BY id) as rn
               FROM squares_info
             ) si
             JOIN questions q ON si.question_id = q.id
             WHERE q.assignment_id = ? AND si.rn = 1`,
            [assignmentId]
          )
        : [];

    // Polygon 모드: 사용자별 폴리곤과 캔버스 정보 조회
    const polygonsData =
      assignment_mode === "Polygon"
        ? await fetchData(
            `SELECT pi.question_id AS questionIndex, pi.coordinates, pi.class_type AS classType, pi.user_id
             FROM polygon_info pi
             JOIN questions q ON pi.question_id = q.id
             WHERE q.assignment_id = ?`,
            [assignmentId]
          )
        : [];

    const canvasData = await fetchData(
      `SELECT ci.id, ci.width, ci.height, ci.user_id
       FROM canvas_info ci
       WHERE ci.assignment_id = ?`,
      [assignmentId]
    );

    let fileName = "";

    const structuredData = usersData.reduce((acc, user) => {
      const {
        name,
        questionId,
        questionImage,
        userId,
        FileName,
        originalSelection,
        squareCount,
      } = user;
      if (!fileName) {
        fileName = FileName;
      }
      let selection = originalSelection;
      if (assignment_mode === "BBox") {
        selection = squareCount;
      } else if (assignment_mode === "Polygon") {
        // 해당 사용자/문항의 폴리곤 개수
        const userPolygonCount = polygonsData.filter(
          (p) => p.user_id === userId && p.questionIndex === questionId
        ).length;
        selection = userPolygonCount;
      }
      if (!acc[name]) {
        acc[name] = {
          name,
          userId,
          questions: [],
          answeredCount: 0,
          unansweredCount: 0,
        };
        // 공통 beforeCanvas (뷰어에서 스케일 계산용)
        acc[name].beforeCanvas = canvasData.find(
          (canvas) => canvas.user_id === userId
        );
        if (assignment_mode === "BBox") {
          acc[name].squares = squaresData.filter(
            (square) => square.user_id === userId
          );
        } else if (assignment_mode === "Polygon") {
          acc[name].polygons = polygonsData
            .filter((p) => p.user_id === userId)
            .map((p) => ({
              points: JSON.parse(p.coordinates || "[]"),
              class: p.classType,
              isComplete: true,
              questionIndex: p.questionIndex,
            }));
        }
      }

      acc[name].questions.push({
        questionId,
        questionImage,
        questionSelection: selection,
      });
  selection > 0 ? acc[name].answeredCount++ : acc[name].unansweredCount++;
      return acc;
    }, {});

    Object.values(structuredData).forEach((user) =>
      user.questions.sort((a, b) => a.questionId - b.questionId)
    );

    res.status(200).json({
      assignment: Object.values(structuredData),
      assignmentMode: assignment_mode,
      FileName: fileName,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
