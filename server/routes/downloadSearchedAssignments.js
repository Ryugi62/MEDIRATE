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
            const normalizedSquares = normalizeSquares(
              users,
              question.questionId,
              assignmentData.imageSize
            );
            const { overlapCount, overlapGroups } = getOverlaps(
              normalizedSquares,
              question.questionId,
              halfRoundedEvaluatorCount
            );
            const { matchedCount, unmatchedCount } =
              getMatchedAndUnmatchedCounts(
                overlapGroups,
                aiData,
                question.questionId
              );

            row.push(overlapCount, matchedCount, unmatchedCount);

            const json = JSON.stringify({
              filename: questionImageFileName,
              annotation: overlapGroups.map((group) => ({
                category_id: group[0].category_id,
                bbox: [group[0].x - 12.5, group[0].y - 12.5, 25, 25],
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

  // Fetch the original image size
  const imageSizeQuery = `SELECT width, height FROM questions WHERE assignment_id = ? LIMIT 1`;
  const [imageSizeResult] = await db.query(imageSizeQuery, [assignmentId]);
  const imageSize = imageSizeResult[0] || { width: 1000, height: 1000 }; // Default size if not found

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

      const canvasQuery = `SELECT width, height FROM canvas_info WHERE assignment_id = ? AND user_id = ?`;
      const [canvasResult] = await db.query(canvasQuery, [
        assignmentId,
        user.id,
      ]);
      const canvas = canvasResult[0] || { width: 1000, height: 1000 }; // Default size if not found

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
        canvas,
      };
    })
  );

  return { assignment, imageSize };
}

function normalizeSquares(users, questionId, originalImageSize) {
  return users.flatMap((user) => {
    const { width: canvasWidth, height: canvasHeight } = user.canvas;
    const { width: imageWidth, height: imageHeight } = originalImageSize;

    const scaleX = imageWidth / canvasWidth;
    const scaleY = imageHeight / canvasHeight;

    return user.squares
      .filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      )
      .map((square) => ({
        ...square,
        x: square.x * scaleX,
        y: square.y * scaleY,
        color: user.color, // Assuming each user has a color property
      }));
  });
}

async function getAIData(assignmentId) {
  // ... (getAIData function remains the same)
}

function getValidSquaresCount(squares, questionId) {
  return squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  ).length;
}

function getOverlaps(squares, questionId, overlapCount) {
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
        Math.abs(square.y - otherSquare.y) <= 12.5 &&
        square.color !== otherSquare.color
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

  return { overlapCount: groups.length, overlapGroups: groups };
}

function getMatchedAndUnmatchedCounts(overlapGroups, aiData, questionId) {
  const relevantAiData = aiData.filter((ai) => ai.questionIndex === questionId);

  let matchedCount = 0;
  let unmatchedCount = 0;

  overlapGroups.forEach((group) => {
    const isMatched = relevantAiData.some((ai) =>
      group.some(
        (bbox) =>
          Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
      )
    );

    if (isMatched) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }
  });

  return { matchedCount, unmatchedCount };
}

module.exports = router;
