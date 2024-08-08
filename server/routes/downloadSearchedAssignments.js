const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../jwt");
const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");

router.post(
  "/download-searched-assigments",
  authenticateToken,
  async (req, res) => {
    try {
      const assignmentIds = req.body.data.map((assignment) => assignment.id);
      const userId = req.user.id;

      const workbook = new ExcelJS.Workbook();

      for (const assignmentId of assignmentIds) {
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

        // AI BBox data
        const assignmentType = questions[0].image.split("/").slice(-2)[0];
        const AI_BBOX = [];
        for (const question of questions) {
          const jsonSrc = question.image
            .split("/")
            .pop()
            .replace(/\.(jpg|png)/, ".json");
          try {
            const jsonContent = await fs.readFile(
              `./assets/${assignmentType}/${jsonSrc}`,
              "utf8"
            );
            const bbox = JSON.parse(jsonContent).annotation.map(
              (annotation) => {
                const [x, y] = annotation.bbox;
                return { x, y, questionIndex: question.id };
              }
            );
            AI_BBOX.push(...bbox);
          } catch (error) {
            console.error("Error reading JSON file:", error);
          }
        }

        const worksheet = workbook.addWorksheet(assignment[0].FileName);

        const halfRoundedEvaluatorCount = Math.round(assignment.length / 2);
        const columns = [
          { header: "문제 번호", key: "questionNumber", width: 10 },
          { header: assignment[0].studentName, key: "studentName", width: 15 },
        ];

        if (assignment[0].assignmentMode === "BBox") {
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
            },
            { header: "Json", key: "json", width: 15 }
          );
        }

        worksheet.columns = columns;

        questions.forEach((question, index) => {
          const questionImageFileName = question.image.split("/").pop();
          const row = {
            questionNumber: questionImageFileName,
            studentName: getValidSquaresCount(squares, question.id),
          };

          if (assignment[0].assignmentMode === "BBox") {
            const overlapCount = getOverlaps(
              squares,
              question.id,
              halfRoundedEvaluatorCount
            );
            const matchedCount = getMatchedCount(
              squares,
              AI_BBOX,
              question.id,
              halfRoundedEvaluatorCount
            );
            const unmatchedCount = overlapCount - matchedCount;

            row[`overlap${halfRoundedEvaluatorCount}`] = overlapCount;
            row[`matched${halfRoundedEvaluatorCount}`] = matchedCount;
            row[`unmatched${halfRoundedEvaluatorCount}`] = unmatchedCount;

            row["json"] = JSON.stringify({
              filename: questionImageFileName,
              annotation: getOverlapSquares(
                squares,
                question.id,
                halfRoundedEvaluatorCount
              ).map((bbox) => ({
                category_id: bbox.category_id,
                bbox: [bbox.x - 12.5, bbox.y - 12.5, 25, 25],
              })),
            });
          }

          worksheet.addRow(row);
        });

        worksheet.getRow(1).font = { bold: true };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=assignments_responses.xlsx"
      );
      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel file:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Helper functions
function getValidSquaresCount(squares, questionId) {
  return squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  ).length;
}

function getOverlaps(squares, questionId, overlapCount) {
  const relevantSquares = squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  );
  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;
    visited.add(square);
    group.push(square);

    relevantSquares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  relevantSquares.forEach((square) => {
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

function getMatchedCount(squares, aiData, questionId, overlapCount) {
  const relevantSquares = squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  );
  const relevantAiData = aiData.filter((ai) => ai.questionIndex === questionId);

  const overlapSquares = getOverlapSquares(squares, questionId, overlapCount);

  return overlapSquares.filter((bbox) =>
    relevantAiData.some(
      (ai) => Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
    )
  ).length;
}

function getOverlapSquares(squares, questionId, overlapCount) {
  const relevantSquares = squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  );
  const groups = [];
  const visited = new Set();

  function dfs(square, group) {
    if (visited.has(square)) return;
    visited.add(square);
    group.push(square);

    relevantSquares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  relevantSquares.forEach((square) => {
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

module.exports = router;
