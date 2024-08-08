const express = require("express");
const router = express.Router();
const authenticateToken = require("../jwt");
const ExcelJS = require("exceljs");
const db = require("../db");
const fs = require("fs").promises;
const path = require("path");
const sizeOf = require("image-size");
const util = require("util");
const sizeOfPromise = util.promisify(sizeOf);
const url = require("url");

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
            const adjustedSquares = getAdjustedSquares(users, question);

            console.log("adjustedSquares", adjustedSquares);

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

function getAdjustedSquares(users, question) {
  return users.flatMap((user) =>
    user.squares
      .filter(
        (square) =>
          square.questionIndex === question.questionId && !square.isTemporary
      )
      .map((square) =>
        adjustCoordinates(square, user.beforeCanvas, {
          width: question.originalWidth,
          height: question.originalHeight,
        })
      )
  );
}

function adjustCoordinates(square, beforeCanvas, originalSize) {
  const beforePosition = calculateImagePosition(
    beforeCanvas.width,
    beforeCanvas.height,
    originalSize.width,
    originalSize.height
  );
  const currentPosition = calculateImagePosition(
    originalSize.width,
    originalSize.height,
    originalSize.width,
    originalSize.height
  );
  const scaleRatio = currentPosition.scale / beforePosition.scale;

  return {
    ...square,
    x: (square.x - beforePosition.x) * scaleRatio + currentPosition.x,
    y: (square.y - beforePosition.y) * scaleRatio + currentPosition.y,
  };
}

function calculateImagePosition(
  canvasWidth,
  canvasHeight,
  originalWidth,
  originalHeight
) {
  const scale = Math.min(
    canvasWidth / originalWidth,
    canvasHeight / originalHeight
  );
  const x = (canvasWidth - originalWidth * scale) / 2;
  const y = (canvasHeight - originalHeight * scale) / 2;

  return { x, y, scale };
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

function getMatchedCount(overlapSquares, aiData) {
  return overlapSquares.filter((bbox) =>
    aiData.some(
      (ai) => Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
    )
  ).length;
}

async function fetchAssignmentData(assignmentId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [assignmentInfo] = await connection.query(
      `SELECT title as FileName, assignment_mode as assignmentMode FROM assignments WHERE id = ?`,
      [assignmentId]
    );

    const [users] = await connection.query(
      `SELECT u.id as userId, u.username as name
       FROM users u
       JOIN assignment_user au ON u.id = au.user_id
       WHERE au.assignment_id = ?`,
      [assignmentId]
    );

    const [questions] = await connection.query(
      `SELECT id as questionId, image as questionImage FROM questions WHERE assignment_id = ?`,
      [assignmentId]
    );

    // 이미지 크기 정보 가져오기
    for (let question of questions) {
      const parsedUrl = url.parse(question.questionImage);
      const relativePath = parsedUrl.pathname.replace("/api/assets/", "");
      const imagePath = path.join(__dirname, "..", "assets", relativePath);

      try {
        const dimensions = await sizeOfPromise(imagePath);
        question.originalWidth = dimensions.width;
        question.originalHeight = dimensions.height;
      } catch (error) {
        console.error(
          `Error getting image dimensions for ${imagePath}:`,
          error
        );
        question.originalWidth = 1000; // 기본값 설정
        question.originalHeight = 1000; // 기본값 설정
      }
    }

    const [responses] = await connection.query(
      `SELECT qr.question_id, qr.user_id, qr.selected_option as questionSelection
       FROM question_responses qr
       JOIN questions q ON qr.question_id = q.id
       WHERE q.assignment_id = ?`,
      [assignmentId]
    );

    const [squares] = await connection.query(
      `SELECT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
       FROM squares_info si
       JOIN questions q ON si.question_id = q.id
       WHERE q.assignment_id = ?`,
      [assignmentId]
    );

    const [canvasInfo] = await connection.query(
      `SELECT user_id, width, height FROM canvas_info WHERE assignment_id = ?`,
      [assignmentId]
    );

    const structuredData = users.map((user) => ({
      ...user,
      questions: questions.map((q) => ({
        questionId: q.questionId,
        questionImage: q.questionImage,
        originalWidth: q.originalWidth,
        originalHeight: q.originalHeight,
        questionSelection:
          responses.find(
            (r) => r.question_id === q.questionId && r.user_id === user.userId
          )?.questionSelection || -1,
      })),
      squares: squares.filter((s) => s.user_id === user.userId),
      beforeCanvas: canvasInfo.find((c) => c.user_id === user.userId) || {
        width: 1000,
        height: 1000,
      },
      answeredCount: 0,
      unansweredCount: 0,
    }));

    structuredData.forEach((user) => {
      user.questions.forEach((q) => {
        if (q.questionSelection > 0) {
          user.answeredCount++;
        } else {
          user.unansweredCount++;
        }
      });
    });

    await connection.commit();
    return {
      assignment: structuredData,
      assignmentMode: assignmentInfo[0].assignmentMode,
      FileName: assignmentInfo[0].FileName,
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
          path.join(__dirname, `../../assets/${assignmentType}/${jsonSrc}`),
          "utf8"
        );
        const bbox = JSON.parse(jsonContent).annotation.map((annotation) => {
          const [x, y] = annotation.bbox;
          return { x: x + 12.5, y: y + 12.5, questionIndex: question.id };
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
