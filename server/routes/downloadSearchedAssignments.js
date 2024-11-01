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

// 모든 평가자를 포함하는 열 생성
async function getAllEvaluators(assignments) {
  const evaluatorSet = new Set();

  for (const assignmentSummary of assignments) {
    const assignmentData = await fetchAssignmentData(assignmentSummary.id);
    const users = assignmentData.assignment;

    // 평가자 ID 및 이름을 추가
    users.forEach((user) => evaluatorSet.add(user.name));
  }

  return Array.from(evaluatorSet);
}

router.post(
  "/download-searched-assignments",
  authenticateToken,
  async (req, res) => {
    try {
      let sliderValue = req.body.sliderValue;
      const assignments = req.body.data;
      const score_value = req.body.score_value;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assignment Responses");

      const allEvaluators = await getAllEvaluators(assignments);
      const commonColumns = [
        { header: `과제 ID`, key: `assignmentId`, width: 10 },
        { header: "문제 번호", key: "questionNumber", width: 10 },
      ];

      // 모든 평가자에 대한 열 추가
      const evaluatorColumns = allEvaluators.map((name) => ({
        header: name,
        key: name,
        width: 15,
      }));

      const bboxColumns = [
        {
          header: `+${sliderValue}인`,
          key: `overlap${sliderValue}`,
          width: 10,
        },
        { header: `AI개수`, key: `aiCount`, width: 10 },
        {
          header: `${sliderValue}일치`,
          key: `matched${sliderValue}`,
          width: 10,
        },
        { header: `FN`, key: `fn${sliderValue}`, width: 10 },
        { header: `FP`, key: `fp${sliderValue}`, width: 10 },
        { header: `JSON`, key: `json`, width: 30 },
      ];

      worksheet.columns = [
        ...commonColumns,
        ...evaluatorColumns,
        ...(assignments[0].assignmentMode === "BBox" ? bboxColumns : []),
      ];

      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const aiData = await getAIData(assignmentSummary.id);
        const users = assignmentData.assignment;

        const max_slider_value = users.length;

        if (sliderValue > max_slider_value) {
          sliderValue = max_slider_value;
        }

        for (const question of assignmentData.assignment[0].questions) {
          const questionImageFileName = question.questionImage.split("/").pop();
          const row = { questionNumber: questionImageFileName };
          row["assignmentId"] = assignmentSummary.id;

          allEvaluators.forEach((name) => {
            const user = users.find((u) => u.name === name);
            row[name] = user
              ? getValidSquaresCount(user.squares, question.questionId)
              : 0; // 과제에 할당되지 않은 평가자는 0 설정
          });

          if (assignmentData.assignmentMode === "BBox") {
            const adjustedSquares = await getAdjustedSquares(users, question);
            const relevantAiData = aiData.filter(
              (ai) =>
                ai.questionIndex === question.questionId &&
                ai.score >= score_value
            );

            const overlapGroups = getOverlapsBBoxes(
              adjustedSquares,
              sliderValue
            );
            const overlapCount = overlapGroups.length;
            const matchedCount = getMatchedCount(overlapGroups, relevantAiData);

            row[`overlap${sliderValue}`] = overlapCount;
            row["aiCount"] = relevantAiData.length;
            row[`matched${sliderValue}`] = matchedCount;
            row[`fn${sliderValue}`] = overlapCount - matchedCount;
            row[`fp${sliderValue}`] = relevantAiData.length - matchedCount;

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
    console.error(`Error getting image dimensions for ${imageUrl}:`, error);
    return { width: 1000, height: 1000 }; // 기본값 설정
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

function getOverlapsBBoxes(squares, overlapCount) {
  if (overlapCount === 1) {
    return squares.map((square) => [square]);
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

  return groups;
}

function getMatchedCount(overlapGroups, aiData) {
  let matchedCount = 0;
  overlapGroups.forEach((group) => {
    if (
      group.some((bbox) =>
        aiData.some(
          (ai) =>
            Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
        )
      )
    ) {
      matchedCount++;
    }
  });
  return matchedCount;
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

    const AI_BBOX = [];

    for (const question of questions) {
      const jsonPath = getImageLocalPath(question.image).replace(
        /\.(jpg|png|jpeg)$/i,
        ".json"
      );

      try {
        const jsonContent = await fs.readFile(jsonPath, "utf8");
        const bbox = JSON.parse(jsonContent).annotation.map((annotation) => {
          const [x, y] = annotation.bbox;
          const score = annotation.score ? annotation.score : 0.6;
          return {
            x: x + 12.5,
            y: y + 12.5,
            questionIndex: question.id,
            score: score,
          };
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
