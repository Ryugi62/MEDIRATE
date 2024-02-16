const express = require("express");
const router = express.Router();
const db = require("../db"); // 가정: 데이터베이스 연결 설정이 포함된 모듈
const authenticateToken = require("../jwt");

require("dotenv").config();

// 과제 데이터와 함께 답변율 및 미답변율을 계산하여 반환하는 라우트
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [assignments] = await db.query(`
      SELECT 
        a.id, 
        a.title, 
        a.creation_date AS createdAt, 
        a.deadline AS endAt,
        COUNT(DISTINCT au.user_id) AS evaluatorCount,
        ROUND(IFNULL((SELECT COUNT(DISTINCT ua.user_id) 
                      FROM user_answers ua 
                      INNER JOIN questions q ON ua.question_id = q.id 
                      WHERE q.assignment_id = a.id) / COUNT(DISTINCT q.id) * 100, 0), 2) AS answerRate,
        ROUND(100 - IFNULL((SELECT COUNT(DISTINCT ua.user_id) 
                            FROM user_answers ua 
                            INNER JOIN questions q ON ua.question_id = q.id 
                            WHERE q.assignment_id = a.id) / COUNT(DISTINCT q.id) * 100, 0), 2) AS unansweredRate
      FROM assignments a
      LEFT JOIN assignment_user au ON a.id = au.assignment_id
      LEFT JOIN questions q ON a.id = q.assignment_id
      GROUP BY a.id
    `);

    // 데이터 포맷 변환 (날짜 포맷 등)
    const formattedAssignments = assignments.map((assignment) => ({
      ...assignment,
      createdAt: assignment.createdAt.toISOString().split("T")[0],
      endAt: assignment.endAt.toISOString().split("T")[0],
      answerRate: `${assignment.answerRate}%`,
      unansweredRate: `${assignment.unansweredRate}%`,
    }));

    console.log(formattedAssignments);

    res.json(formattedAssignments);
  } catch (error) {
    console.error("Failed to fetch assignments:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 특정 게시글 조회
router.get("/:id", async (req, res) => {});

// 게시글 삭제
router.delete("/:id", async (req, res) => {});

module.exports = router;
