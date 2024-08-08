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
            const overlapCount = getOverlaps(
              users,
              question.questionId,
              halfRoundedEvaluatorCount
            );
            const overlapBBoxes = getOverlapsBBoxes(
              users,
              question.questionId,
              halfRoundedEvaluatorCount
            );
            const matchedCount = getMatchedCount(
              overlapBBoxes,
              aiData,
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
                bbox: [bbox.x - 12.5, bbox.y - 12.5, 25, 25],
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

function getOverlaps(users, questionId, overlapCount) {
  let squares = [];
  users.forEach((person) => {
    squares = squares.concat(
      person.squares.filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      )
    );
  });

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

function getOverlapsBBoxes(users, questionId, overlapCount) {
  let squares = [];
  users.forEach((person) => {
    squares = squares.concat(
      person.squares.filter(
        (square) => square.questionIndex === questionId && !square.isTemporary
      )
    );
  });

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

  return aiData.map((ai) => ({
    ...ai,
    x: ai.x + 12.5,
    y: ai.y + 12.5,
  }));
}

module.exports = router;
