const express = require("express");
const router = express.Router();
const authenticateToken = require("../jwt");
const ExcelJS = require("exceljs");
const db = require("../db");

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
            const allSquares = users.flatMap((user) => user.squares);
            const overlapSquares = getOverlapSquares(
              allSquares,
              question.questionId,
              halfRoundedEvaluatorCount
            );
            const overlapCount = overlapSquares.length;
            const matchedCount = getMatchedCount(
              overlapSquares,
              aiData,
              question.questionId
            );
            const unmatchedCount = overlapCount - matchedCount;

            row.push(overlapCount, matchedCount, unmatchedCount);

            const json = JSON.stringify({
              filename: questionImageFileName,
              annotation: overlapSquares.map((bbox) => ({
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

function getValidSquaresCount(squares, questionId) {
  return squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
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

function getMatchedCount(overlapSquares, aiData, questionId) {
  const relevantAiData = aiData.filter((ai) => ai.questionIndex === questionId);

  return overlapSquares.filter((bbox) =>
    relevantAiData.some(
      (ai) => Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
    )
  ).length;
}

async function fetchAssignmentData(assignmentId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [users] = await connection.query(
      `
      SELECT u.id, u.username AS name
      FROM users u
      JOIN assignment_user au ON u.id = au.user_id
      WHERE au.assignment_id = ?
    `,
      [assignmentId]
    );

    const [questions] = await connection.query(
      `
      SELECT id, image AS questionImage
      FROM questions
      WHERE assignment_id = ?
    `,
      [assignmentId]
    );

    const [squares] = await connection.query(
      `
      SELECT si.id, si.x, si.y, si.question_id AS questionIndex, si.isAI, si.isTemporary, si.user_id
      FROM squares_info si
      JOIN questions q ON si.question_id = q.id
      WHERE q.assignment_id = ?
    `,
      [assignmentId]
    );

    const [responses] = await connection.query(
      `
      SELECT qr.question_id, qr.selected_option AS questionSelection, qr.user_id
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE q.assignment_id = ?
    `,
      [assignmentId]
    );

    const [assignmentMode] = await connection.query(
      `
      SELECT assignment_mode AS assignmentMode
      FROM assignments
      WHERE id = ?
    `,
      [assignmentId]
    );

    const assignment = users.map((user) => ({
      ...user,
      questions: questions.map((q) => ({
        questionId: q.id,
        questionImage: q.questionImage,
        questionSelection:
          responses.find((r) => r.question_id === q.id && r.user_id === user.id)
            ?.questionSelection || -1,
      })),
      squares: squares.filter((s) => s.user_id === user.id),
    }));

    await connection.commit();
    return { assignment, assignmentMode: assignmentMode[0].assignmentMode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAIData(assignmentId) {
  const [aiData] = await db.query(
    `
    SELECT si.x, si.y, si.question_id AS questionIndex
    FROM squares_info si
    JOIN questions q ON si.question_id = q.id
    WHERE q.assignment_id = ? AND si.isAI = 1
  `,
    [assignmentId]
  );

  return aiData;
}

module.exports = router;
