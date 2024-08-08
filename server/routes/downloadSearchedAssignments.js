const express = require("express");
const router = express.Router();
const authenticateToken = require("../jwt");
const ExcelJS = require("exceljs");
const db = require("../db");
const fs = require("fs").promises;
const path = require("path");

router.post(
  "/download-searched-assigments",
  authenticateToken,
  async (req, res) => {
    try {
      const assignments = req.body.data;
      console.log(`Received ${assignments.length} assignments for processing`);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignments Data");

      let currentRow = 1;

      for (const assignmentSummary of assignments) {
        console.log(
          `Processing assignment: ${assignmentSummary.id} - ${assignmentSummary.title}`
        );

        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const aiData = await getAIData(assignmentSummary.id);

        const users = assignmentData.assignment;
        const halfRoundedEvaluatorCount = Math.round(users.length / 2);

        // Add headers for this assignment
        const headers = [
          "과제 번호",
          "문제 번호",
          ...users.map((user) => user.name),
          `+${halfRoundedEvaluatorCount}인`,
          `${halfRoundedEvaluatorCount}일치`,
          `${halfRoundedEvaluatorCount}불일치`,
          "Json",
        ];

        worksheet.getRow(currentRow).values = headers;
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;

        const questions = assignmentData.assignment[0].questions;

        for (const question of questions) {
          const questionImageFileName = question.questionImage.split("/").pop();
          const row = [
            assignmentSummary.id,
            questionImageFileName,
            ...users.map((user) => {
              if (assignmentSummary.assignmentMode === "BBox") {
                return getValidSquaresCount(user.squares, question.questionId);
              } else {
                return user.questions.find(
                  (q) => q.questionId === question.questionId
                ).questionSelection;
              }
            }),
          ];

          if (assignmentSummary.assignmentMode === "BBox") {
            const allSquares = users.flatMap((user) => user.squares);
            const overlapCount = getOverlaps(
              allSquares,
              question.questionId,
              halfRoundedEvaluatorCount
            );
            const matchedCount = getMatchedCount(
              allSquares,
              aiData,
              question.questionId,
              halfRoundedEvaluatorCount
            );
            const unmatchedCount = overlapCount - matchedCount;

            row.push(overlapCount, matchedCount, unmatchedCount);

            const json = JSON.stringify({
              filename: questionImageFileName,
              annotation: getOverlapSquares(
                allSquares,
                question.questionId,
                halfRoundedEvaluatorCount
              ).map((bbox) => ({
                category_id: bbox.category_id,
                bbox: [bbox.x - 12.5, bbox.y - 12.5, 25, 25],
              })),
            });

            row.push(json);
          } else {
            // For TextBox mode, add empty cells for BBox-specific columns
            row.push("", "", "", "{}");
          }

          worksheet.getRow(currentRow).values = row;
          currentRow++;
        }

        // Add an empty row between assignments
        currentRow++;
      }

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

async function fetchAssignmentData(assignmentId) {
  const usersQuery = `
    SELECT u.id, u.username AS name
    FROM users u
    JOIN assignment_user au ON u.id = au.user_id
    WHERE au.assignment_id = ?`;
  const [users] = await db.query(usersQuery, [assignmentId]);

  const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
  const [questions] = await db.query(questionsQuery, [assignmentId]);

  const assignment = await Promise.all(
    users.map(async (user) => {
      const responsesQuery = `
      SELECT qr.question_id, qr.selected_option AS questionSelection
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ? AND qr.user_id = ?`;
      const [responses] = await db.query(responsesQuery, [
        assignmentId,
        user.id,
      ]);

      const squaresQuery = `
      SELECT si.id, si.x, si.y, si.question_id as questionIndex, si.isAI, si.isTemporary
      FROM squares_info si
      JOIN questions q ON si.question_id = q.id
      WHERE q.assignment_id = ? AND si.user_id = ?`;
      const [squares] = await db.query(squaresQuery, [assignmentId, user.id]);

      return {
        ...user,
        questions: questions.map((q) => ({
          questionId: q.id,
          questionImage: q.image,
          questionSelection:
            responses.find((r) => r.question_id === q.id)?.questionSelection ||
            -1,
        })),
        squares,
      };
    })
  );

  return { assignment };
}

async function getAIData(assignmentId) {
  const questionsQuery = `SELECT id, image FROM questions WHERE assignment_id = ?`;
  const [questions] = await db.query(questionsQuery, [assignmentId]);

  if (questions.length === 0) return [];

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
      const parsedJson = JSON.parse(jsonContent);

      if (
        parsedJson &&
        parsedJson.annotation &&
        Array.isArray(parsedJson.annotation)
      ) {
        const bbox = parsedJson.annotation
          .map((annotation) => {
            if (
              annotation &&
              annotation.bbox &&
              Array.isArray(annotation.bbox) &&
              annotation.bbox.length >= 2
            ) {
              const [x, y] = annotation.bbox;
              return { x: x + 12.5, y: y + 12.5, questionIndex: question.id };
            }
            return null;
          })
          .filter((item) => item !== null);
        AI_BBOX.push(...bbox);
      }
    } catch (error) {
      console.error(
        `Error reading or parsing JSON file for question ${question.id}:`,
        error
      );
    }
  }

  return AI_BBOX;
}

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
