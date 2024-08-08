const express = require("express");
const router = express.Router();
const authenticateToken = require("../jwt");
const ExcelJS = require("exceljs");
const db = require("../db");
const fs = require("fs").promises;
const path = require("path");

router.post(
  "/download-searched-assignments",
  authenticateToken,
  async (req, res) => {
    try {
      const assignments = req.body.data;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");

      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const aiData = await getAIData(assignmentSummary.id);

        const users = assignmentData.assignment;
        const halfRoundedEvaluatorCount = Math.round(users.length / 2);

        const columns = [
          { header: "문제 번호", key: "questionNumber", width: 10 },
          ...users.map((user) => ({
            header: user.name,
            key: user.name,
            width: 15,
          })),
        ];

        if (assignmentData.assignmentMode === "BBox") {
          columns.push(
            {
              header: `+${halfRoundedEvaluatorCount}인`,
              key: `overlap${halfRoundedEvaluatorCount}`,
              width: 10,
            },
            {
              header: `${halfRoundedEvaluatorCount}일치`,
              key: `matched${halfRoundedEvaluatorCount}`,
              width: 10,
            },
            {
              header: `${halfRoundedEvaluatorCount}불일치`,
              key: `unmatched${halfRoundedEvaluatorCount}`,
              width: 10,
            }
          );
        }

        columns.push({ header: "Json", key: "json", width: 30 });

        worksheet.columns = columns;

        assignmentData.assignment[0].questions.forEach((question) => {
          const questionImageFileName = question.questionImage.split("/").pop();
          const row = { questionNumber: questionImageFileName };

          users.forEach((user) => {
            if (assignmentData.assignmentMode === "BBox") {
              row[user.name] = getValidSquaresCount(
                user.squares,
                question.questionId
              );
            } else {
              const userQuestion = user.questions.find(
                (q) => q.questionId === question.questionId
              );
              row[user.name] =
                userQuestion.questionSelection === -1
                  ? "선택되지 않음"
                  : userQuestion.questionSelection;
            }
          });

          if (assignmentData.assignmentMode === "BBox") {
            const adjustedSquares = getAdjustedSquares(
              users,
              question.questionId
            );
            const relevantAiData = aiData.filter(
              (ai) => ai.questionIndex === question.questionId
            );
            const overlapCount = getOverlaps(
              adjustedSquares,
              halfRoundedEvaluatorCount
            );
            const overlapBBoxes = getOverlapsBBoxes(
              adjustedSquares,
              halfRoundedEvaluatorCount
            );
            const matchedCount = getMatchedCount(
              overlapBBoxes,
              relevantAiData,
              question.questionId
            );
            const unmatchedCount = overlapCount - matchedCount;

            row[`overlap${halfRoundedEvaluatorCount}`] = overlapCount;
            row[`matched${halfRoundedEvaluatorCount}`] = matchedCount;
            row[`unmatched${halfRoundedEvaluatorCount}`] = unmatchedCount;

            row["json"] = JSON.stringify({
              filename: questionImageFileName,
              annotation: overlapBBoxes.map((bbox) => ({
                category: bbox.category_id,
                bbox: [bbox.x, bbox.y, 25, 25],
              })),
            });
          } else {
            row["json"] = "{}";
          }

          worksheet.addRow(row);
        });

        worksheet.addRow({});
      }

      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=assignments_data.xlsx"
      );
      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel file:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

function getValidSquaresCount(squares, questionId) {
  return squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  ).length;
}

function getAdjustedSquares(users, questionId) {
  return users.flatMap((user) =>
    user.squares
      .filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      )
      .map((square) => ({
        ...square,
        x: square.x / user.beforeCanvas.width,
        y: square.y / user.beforeCanvas.height,
      }))
  );
}

function getOverlaps(squares, overlapCount) {
  if (overlapCount === 1) {
    return squares.length;
  }

  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;
    visited.add(square);
    group.push(square);

    squares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 / 1000 &&
        Math.abs(square.y - otherSquare.y) <= 12.5 / 1000
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

function getOverlapsBBoxes(squares, overlapCount) {
  if (overlapCount === 1) {
    return squares;
  }

  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;
    visited.add(square);
    group.push(square);

    squares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 / 1000 &&
        Math.abs(square.y - otherSquare.y) <= 12.5 / 1000
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

  return groups.flat();
}

function getMatchedCount(overlapSquares, aiData, questionId) {
  return overlapSquares.filter((bbox) =>
    aiData.some(
      (ai) =>
        Math.abs(bbox.x - ai.x) <= 12.5 / 1000 &&
        Math.abs(bbox.y - ai.y) <= 12.5 / 1000
    )
  ).length;
}

async function fetchAssignmentData(assignmentId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [assignmentData] = await connection.query(
      `
      SELECT u.id AS userId, u.username AS name, q.id AS questionId, q.image AS questionImage, a.title AS FileName,
             COALESCE(qr.selected_option, -1) AS questionSelection, COUNT(DISTINCT si.id) AS squareCount,
             a.assignment_mode AS assignmentMode, ci.width AS canvasWidth, ci.height AS canvasHeight
      FROM users u
      JOIN assignment_user au ON u.id = au.user_id
      JOIN assignments a ON au.assignment_id = a.id
      LEFT JOIN questions q ON au.assignment_id = q.assignment_id
      LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.user_id = u.id
      LEFT JOIN squares_info si ON q.id = si.question_id AND si.user_id = u.id
      LEFT JOIN canvas_info ci ON a.id = ci.assignment_id AND u.id = ci.user_id
      WHERE au.assignment_id = ?
      GROUP BY u.id, q.id
    `,
      [assignmentId]
    );

    const [squaresData] = await connection.query(
      `
      SELECT DISTINCT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
      FROM (
        SELECT question_id, x, y, user_id, isAI, isTemporary,
               ROW_NUMBER() OVER (PARTITION BY question_id, x, y, user_id ORDER BY id) as rn
        FROM squares_info
      ) si
      JOIN questions q ON si.question_id = q.id
      WHERE q.assignment_id = ? AND si.rn = 1
    `,
      [assignmentId]
    );

    const structuredData = assignmentData.reduce((acc, user) => {
      const {
        userId,
        name,
        questionId,
        questionImage,
        FileName,
        questionSelection,
        squareCount,
        assignmentMode,
        canvasWidth,
        canvasHeight,
      } = user;

      if (!acc[name]) {
        acc[name] = {
          name,
          userId,
          questions: [],
          answeredCount: 0,
          unansweredCount: 0,
          squares: [],
          beforeCanvas: { width: canvasWidth, height: canvasHeight },
        };
      }

      const selection =
        assignmentMode === "BBox" ? squareCount : questionSelection;
      acc[name].questions.push({
        questionId,
        questionImage,
        questionSelection: selection,
      });

      selection > 0 ? acc[name].answeredCount++ : acc[name].unansweredCount++;

      if (assignmentMode === "BBox") {
        acc[name].squares = squaresData.filter(
          (square) => square.user_id === userId
        );
      }

      return acc;
    }, {});

    Object.values(structuredData).forEach((user) =>
      user.questions.sort((a, b) => a.questionId - b.questionId)
    );

    await connection.commit();
    return {
      assignment: Object.values(structuredData),
      assignmentMode: assignmentData[0].assignmentMode,
      FileName: assignmentData[0].FileName,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAIData(assignmentId) {
  try {
    const [questions] = await db.query(
      `SELECT id, image FROM questions WHERE assignment_id = ?`,
      [assignmentId]
    );

    const assignmentType = questions[0].image.split("/").slice(-2)[0];
    const AI_BBOX = [];

    for (const question of questions) {
      const jsonSrc = question.image
        .split("/")
        .pop()
        .replace(/\.(jpg|png)/, ".json");

      try {
        const jsonContent = await fs.readFile(
          path.join(__dirname, `../assets/${assignmentType}/${jsonSrc}`),
          "utf8"
        );
        const bbox = JSON.parse(jsonContent).annotation.map((annotation) => {
          const [x, y] = annotation.bbox;
          return { x: x - 12.5, y: y - 12.5, questionIndex: question.id };
        });
        AI_BBOX.push(...bbox);
      } catch (error) {
        console.error("Error reading JSON file:", error);
      }
    }

    return AI_BBOX;
  } catch (error) {
    console.error("Error fetching AI assignment:", error);
    throw error;
  }
}

module.exports = router;
