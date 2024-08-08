const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const db = require("../db");
const authenticateToken = require("../jwt");
const fs = require("fs");

router.get("/:assignmentIds", authenticateToken, async (req, res) => {
  const assignmentIds = req.params.assignmentIds.split(",");

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("All Assignments");

    // 헤더 설정
    worksheet.columns = [
      { header: "과제ID", key: "assignmentId", width: 10 },
      { header: "문제 번호", key: "questionNumber", width: 30 },
    ];

    let users = [];
    let maxUserCount = 0;

    // 모든 과제의 사용자 정보를 가져옵니다
    for (const assignmentId of assignmentIds) {
      const [assignmentUsers] = await db.query(
        `SELECT DISTINCT u.username 
         FROM users u
         JOIN assignment_user au ON u.id = au.user_id
         WHERE au.assignment_id = ?`,
        [assignmentId]
      );

      users.push(assignmentUsers.map((u) => u.username));
      maxUserCount = Math.max(maxUserCount, assignmentUsers.length);
    }

    // 사용자 열 추가
    for (let i = 0; i < maxUserCount; i++) {
      worksheet.columns.push({
        header: `user${i + 1}`,
        key: `user${i + 1}`,
        width: 15,
      });
    }

    // +#인, #일치, #불일치, Json 열 추가
    worksheet.columns.push(
      { header: "+#인", key: "overlapCount", width: 10 },
      { header: "#일치", key: "matchedCount", width: 10 },
      { header: "#불일치", key: "unmatchedCount", width: 10 },
      { header: "Json", key: "json", width: 50 }
    );

    for (let i = 0; i < assignmentIds.length; i++) {
      const assignmentId = assignmentIds[i];
      const [questions] = await db.query(
        `SELECT DISTINCT q.id, q.image AS questionImage
         FROM questions q
         WHERE q.assignment_id = ?`,
        [assignmentId]
      );

      const [squaresData] = await db.query(
        `SELECT DISTINCT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI
         FROM squares_info si
         JOIN questions q ON si.question_id = q.id
         WHERE q.assignment_id = ?`,
        [assignmentId]
      );

      const halfRoundedEvaluatorCount = Math.round(users[i].length / 2);

      // AI 데이터 가져오기
      const AI_BBOX = await getAIData(assignmentId);

      questions.forEach((question) => {
        let row = {
          assignmentId: assignmentId,
          questionNumber: question.questionImage.split("/").pop(),
        };

        users[i].forEach((user, uIndex) => {
          const userSquares = squaresData.filter(
            (s) => s.user_id === user && s.questionIndex === question.id
          );
          row[`user${uIndex + 1}`] = userSquares.length;
        });

        // Fill empty user cells with 0
        for (let j = users[i].length; j < maxUserCount; j++) {
          row[`user${j + 1}`] = 0;
        }

        const allSquares = squaresData.filter(
          (s) => s.questionIndex === question.id
        );

        const overlapCount = getOverlaps(allSquares, halfRoundedEvaluatorCount);
        const matchedCount = getMatchedCount(
          allSquares,
          AI_BBOX.filter((b) => b.questionIndex === question.id),
          halfRoundedEvaluatorCount
        );
        const unmatchedCount = overlapCount - matchedCount;

        row.overlapCount = overlapCount;
        row.matchedCount = matchedCount;
        row.unmatchedCount = unmatchedCount;
        row.json = JSON.stringify({
          filename: question.questionImage.split("/").pop(),
          annotation: getOverlapBBoxes(
            allSquares,
            halfRoundedEvaluatorCount
          ).map((bbox) => ({
            category_id: bbox.category_id,
            bbox: [bbox.x - 12.5, bbox.y - 12.5, 25, 25],
          })),
        });

        worksheet.addRow(row);
      });
    }

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=all_assignments.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).send("Internal Server Error");
  }
});

async function getAIData(assignmentId) {
  const [questions] = await db.query(
    `SELECT id, image FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

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

      const bbox = JSON.parse(jsonContent).annotation.map((annotation) => {
        const [x, y] = annotation.bbox;
        return { x, y, questionIndex: question.id };
      });

      AI_BBOX.push(...bbox);
    } catch (error) {
      console.error("Error reading JSON file:", error);
    }
  });

  return AI_BBOX;
}

function getOverlaps(squares, overlapCount) {
  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;
    visited.add(square);
    group.push(square);

    squares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  squares.forEach((square) => {
    if (!visited.has(square)) {
      const group = [];
      dfs(square, group);
      if (group.length >= overlapCount) {
        groups.push(group);
      }
    }
  });

  return groups.length;
}

function getOverlapBBoxes(squares, overlapCount) {
  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;
    visited.add(square);
    group.push(square);

    squares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  squares.forEach((square) => {
    if (!visited.has(square)) {
      const group = [];
      dfs(square, group);
      if (group.length >= overlapCount) {
        groups.push(group);
      }
    }
  });

  return groups.map((group) => group[0]);
}

function getMatchedCount(squares, aiBBoxes, overlapCount) {
  const overlapGroups = getOverlapBBoxes(squares, overlapCount);

  let matchedCount = 0;
  overlapGroups.forEach((bbox) => {
    if (
      aiBBoxes.some(
        (aiBox) =>
          Math.abs(bbox.x - aiBox.x) <= 12.5 &&
          Math.abs(bbox.y - aiBox.y) <= 12.5
      )
    ) {
      matchedCount++;
    }
  });

  return matchedCount;
}

module.exports = router;
