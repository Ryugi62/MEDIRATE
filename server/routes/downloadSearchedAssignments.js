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

// 로그 큐와 유틸리티 함수
async function logWithQueue(message, data = null) {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    if (data) {
      console.log(logMessage);
      console.log(data);
    } else {
      console.log(logMessage);
    }

    setTimeout(resolve, 10);
  });
}

router.post(
  "/download-searched-assignments",
  authenticateToken,
  async (req, res) => {
    try {
      let sliderValue = req.body.sliderValue;
      const assignments = req.body.data;
      const score_value = req.body.score_value;

      await logWithQueue("Starting download process");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");

      for (const assignmentSummary of assignments) {
        await logWithQueue(`Processing Assignment ID: ${assignmentSummary.id}`);

        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const aiData = await getAIData(assignmentSummary.id);

        const users = assignmentData.assignment;
        const max_slider_value = users.length;

        if (sliderValue > max_slider_value) {
          sliderValue = max_slider_value;
          await logWithQueue(
            `Adjusted slider value to maximum: ${sliderValue}`
          );
        }

        const columns = [
          {
            header: `과제 ID`,
            key: `assignmentId`,
            width: 10,
          },
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
              header: `+${sliderValue}인`,
              key: `overlap${sliderValue}`,
              width: 10,
            },
            {
              header: `AI개수`,
              key: `aiCount`,
              width: 10,
            },
            {
              header: `${sliderValue}일치`,
              key: `matched${sliderValue}`,
              width: 10,
            },
            {
              header: `FN`,
              key: `fn${sliderValue}`,
              width: 10,
            },
            {
              header: `FP`,
              key: `fp${sliderValue}`,
              width: 10,
            },
            {
              header: `JSON`,
              key: `json`,
              width: 30,
            }
          );
        }

        worksheet.columns = columns;

        for (const question of assignmentData.assignment[0].questions) {
          const questionImageFileName = question.questionImage.split("/").pop();
          await logWithQueue(`Processing Question: ${questionImageFileName}`);

          const row = {
            questionNumber: questionImageFileName,
          };

          row["assignmentId"] = assignmentSummary.id;
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
            const adjustedSquares = await getAdjustedSquares(users, question);
            await logWithQueue(
              `Adjusted Squares Count: ${adjustedSquares.length}`
            );

            const relevantAiData = aiData.filter(
              (ai) =>
                ai.questionIndex === question.questionId &&
                ai.score >= score_value
            );
            await logWithQueue(
              `Relevant AI Data Count: ${relevantAiData.length}`
            );

            const overlapGroups = await getOverlapsBBoxes(
              adjustedSquares,
              sliderValue
            );
            const overlapCount = overlapGroups.length;
            const matchedCount = await getMatchedCount(
              overlapGroups,
              relevantAiData
            );

            const fpValue = relevantAiData.length - matchedCount;

            row[`overlap${sliderValue}`] = overlapCount;
            row["aiCount"] = relevantAiData.length;
            row[`matched${sliderValue}`] = matchedCount;
            row[`fn${sliderValue}`] = overlapCount - matchedCount;
            row[`fp${sliderValue}`] = fpValue || 0;

            row["json"] = JSON.stringify({
              filename: questionImageFileName,
              annotation: overlapGroups.map((group) => {
                const x = Math.round(
                  group.reduce((acc, bbox) => acc + bbox.x, 0) / group.length -
                    12.5
                );
                const y = Math.round(
                  group.reduce((acc, bbox) => acc + bbox.y, 0) / group.length -
                    12.5
                );
                return [x, y, 25, 25];
              }),
            });
          }

          worksheet.addRow(row);
        }
      }

      await logWithQueue("Generating Excel file");

      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();

      await logWithQueue("Download process completed");

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
      await logWithQueue("Error generating Excel file:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

function getValidSquaresCount(squares, questionId) {
  return squares.filter(
    (square) => square.questionIndex === questionId && !square.isTemporary
  ).length;
}

function getImageLocalPath(imageUrl) {
  const parsedUrl = new URL(imageUrl);
  const pathParts = parsedUrl.pathname.split("/");
  const folderName = pathParts[pathParts.length - 2];
  const fileName = pathParts[pathParts.length - 1];
  return path.join(__dirname, "..", "..", "assets", folderName, fileName);
}

async function getImageDimensions(imageUrl) {
  try {
    const realPath = getImageLocalPath(imageUrl);
    const dimensions = await sizeOfPromise(realPath);
    return { width: dimensions.width, height: dimensions.height };
  } catch (error) {
    await logWithQueue(
      `Error getting image dimensions for ${imageUrl}:`,
      error
    );
    return { width: 1000, height: 1000 };
  }
}

async function getAdjustedSquares(users, question) {
  const { width: originalWidth, height: originalHeight } =
    await getImageDimensions(question.questionImage);

  return users.flatMap((user) =>
    user.squares
      .filter(
        (square) =>
          square.questionIndex === question.questionId && !square.isTemporary
      )
      .map((square) => {
        const { x: adjustedX, y: adjustedY } =
          convertToOriginalImageCoordinates(
            square.x,
            square.y,
            user.beforeCanvas.width,
            user.beforeCanvas.height,
            originalWidth,
            originalHeight
          );
        return {
          ...square,
          x: adjustedX,
          y: adjustedY,
          width: 25,
          height: 25,
        };
      })
  );
}

function convertToOriginalImageCoordinates(
  x,
  y,
  canvasWidth,
  canvasHeight,
  originalWidth,
  originalHeight
) {
  const currentPosition = calculateImagePosition(
    canvasWidth,
    canvasHeight,
    originalWidth,
    originalHeight
  );

  const scaleRatio = 1 / currentPosition.scale;

  const adjustedX = (x - currentPosition.x) * scaleRatio;
  const adjustedY = (y - currentPosition.y) * scaleRatio;

  return { x: adjustedX, y: adjustedY };
}

function calculateImagePosition(
  canvasWidth,
  canvasHeight,
  imageWidth,
  imageHeight
) {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const x = (canvasWidth - imageWidth * scale) / 2;
  const y = (canvasHeight - imageHeight * scale) / 2;
  return { x, y, scale };
}

async function getOverlapsBBoxes(squares, overlapCount) {
  await logWithQueue(
    `Calculating overlaps for ${squares.length} squares with minimum overlap ${overlapCount}`
  );

  if (overlapCount === 1) {
    return squares.map((square) => [square]);
  }

  const groups = [];
  const visited = new Set();

  async function dfs(square, group) {
    if (visited.has(square)) return;

    visited.add(square);
    group.push(square);

    for (const otherSquare of squares) {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        await dfs(otherSquare, group);
      }
    }
  }

  for (const square of squares) {
    if (!visited.has(square)) {
      const group = [];
      await dfs(square, group);
      if (group.length >= overlapCount) {
        groups.push(group);
      }
    }
  }

  await logWithQueue(`Found ${groups.length} overlap groups`);
  return groups;
}

async function getMatchedCount(overlapGroups, aiData) {
  let matchedCount = 0;

  for (const group of overlapGroups) {
    let isMatched = false;

    for (const bbox of group) {
      for (const ai of aiData) {
        if (
          Math.abs(bbox.x - ai.x) <= 12.5 &&
          Math.abs(bbox.y - ai.y) <= 12.5
        ) {
          isMatched = true;
        }
      }
    }

    if (isMatched) {
      matchedCount++;
    }
  }

  await logWithQueue(`Matched count: ${matchedCount}`);
  return matchedCount;
}

async function fetchAssignmentData(assignmentId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await logWithQueue(`Fetching assignment data for ID: ${assignmentId}`);

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

    for (let question of questions) {
      const { width, height } = await getImageDimensions(
        question.questionImage
      );
      question.originalWidth = width;
      question.originalHeight = height;
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
       WHERE q.assignment_id = ? AND si.isTemporary = 0`,
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

    await logWithQueue(
      `Assignment data fetched successfully for ID: ${assignmentId}`
    );

    await connection.commit();
    return {
      assignment: structuredData,
      assignmentMode: assignmentInfo[0].assignmentMode,
      FileName: assignmentInfo[0].FileName,
    };
  } catch (error) {
    await logWithQueue(
      `Error fetching assignment data for ID: ${assignmentId}`,
      error
    );
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAIData(assignmentId) {
  try {
    await logWithQueue(`Getting AI data for assignment: ${assignmentId}`);

    const [questions] = await db.query(
      `SELECT id, image FROM questions WHERE assignment_id = ?`,
      [assignmentId]
    );

    const AI_BBOX = [];

    for (const question of questions) {
      const jsonPath = getImageLocalPath(question.image).replace(
        /\.(jpg|png|jpeg)$/i,
        ".json"
      );

      try {
        const jsonContent = await fs.readFile(jsonPath, "utf8");
        const jsonData = JSON.parse(jsonContent);

        if (!jsonData.annotation || !Array.isArray(jsonData.annotation)) {
          await logWithQueue(
            `Invalid annotation format for question ${question.id}`,
            jsonData
          );
          continue;
        }

        const bbox = jsonData.annotation
          .map(async (annotation) => {
            if (!annotation.bbox || !Array.isArray(annotation.bbox)) {
              await logWithQueue(`Invalid bbox format`, annotation);
              return null;
            }

            const [x, y] = annotation.bbox;
            const score =
              typeof annotation.score === "number" ? annotation.score : 0.6;

            return {
              x: x + 12.5,
              y: y + 12.5,
              questionIndex: question.id,
              score: score,
            };
          })
          .filter((item) => item !== null);

        AI_BBOX.push(...bbox);

        await logWithQueue(`Question ${question.id} processed`, {
          bboxCount: bbox.length,
        });
      } catch (error) {
        await logWithQueue(`Error processing question ${question.id}`, error);
      }
    }

    await logWithQueue(`AI data processing completed`);

    return AI_BBOX;
  } catch (error) {
    await logWithQueue("Critical Error in getAIData", error);
    return [];
  }
}

module.exports = router;
