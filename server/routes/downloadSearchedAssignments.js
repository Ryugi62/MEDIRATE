// downloadSearchedAssignments.js

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
const archiver = require("archiver");

// 날짜와 시간을 포맷팅하는 함수
function formatDateTime(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = ("0" + (d.getMonth() + 1)).slice(-2);
  const day = ("0" + d.getDate()).slice(-2);
  const hours = ("0" + d.getHours()).slice(-2);
  const minutes = ("0" + d.getMinutes()).slice(-2);
  const seconds = ("0" + d.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 소요 시간을 HH:MM:SS 형식으로 변환하는 함수
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = ("0" + Math.floor(totalSeconds / 3600)).slice(-2);
  const minutes = ("0" + Math.floor((totalSeconds % 3600) / 60)).slice(-2);
  const seconds = ("0" + (totalSeconds % 60)).slice(-2);
  return `${hours}:${minutes}:${seconds}`;
}

// 모든 평가자를 포함하는 열 생성
async function getAllEvaluators(assignments) {
  const evaluatorSet = new Set();

  for (const assignmentSummary of assignments) {
    const assignmentData = await fetchAssignmentData(assignmentSummary.id);
    const users = assignmentData.assignment;

    // 평가자 이름을 추가
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
      const timeSheet = workbook.addWorksheet("시간 Sheet");
      const resultSheet = workbook.addWorksheet("결과 Sheet");

      // 메타데이터 키 수집
      const metadataKeys = new Set();

      // 메타데이터 키를 수집하기 위한 첫 번째 패스
      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        // 폴더 이름 가져오기
        const firstQuestionImageUrl =
          assignmentData.assignment[0].questions[0].questionImage;
        const folderName = getFolderNameFromImageUrl(firstQuestionImageUrl);

        // metadata.json 경로 생성
        const metadataPath = path.join(
          __dirname,
          "..",
          "..",
          "assets",
          folderName,
          "metadata.json"
        );

        try {
          await fs.access(metadataPath);
          // 파일이 존재하면
          const metadataContent = await fs.readFile(metadataPath, "utf8");
          const metadataJson = JSON.parse(metadataContent);
          // 'userid' 키 제외하고 키 추가
          for (const key of Object.keys(metadataJson)) {
            if (key !== "userid") {
              metadataKeys.add(key);
            }
          }
        } catch (err) {
          // 파일이 없으면 무시
        }
      }

      // 시간 시트의 열 정의
      const timeSheetColumns = [
        { header: "과제 ID", key: "assignmentId", width: 15 },
        { header: "평가자 이름", key: "evaluatorName", width: 20 },
        { header: "시작 시간", key: "startTime", width: 20 },
        { header: "종료 시간", key: "endTime", width: 20 },
        { header: "소요 시간", key: "duration", width: 15 },
        { header: "AI 표시 여부", key: "aiIndicator", width: 15 },
      ];

      for (const key of metadataKeys) {
        timeSheetColumns.push({ header: key, key: key, width: 20 });
      }

      timeSheet.columns = timeSheetColumns;

      // 결과 시트의 열 정의
      const allEvaluators = await getAllEvaluators(assignments);
      const commonColumns = [
        { header: `과제 ID`, key: `assignmentId`, width: 10 },
        { header: "이미지", key: "questionNumber", width: 10 },
        { header: "시작 시간", key: "startTime", width: 20 },
        { header: "종료 시간", key: "endTime", width: 20 },
        { header: "소요 시간", key: "duration", width: 15 },
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

      resultSheet.columns = [
        ...commonColumns,
        ...evaluatorColumns,
        ...(assignments[0].assignmentMode === "BBox" ? bboxColumns : []),
        { header: "AI-Json", key: "aiJson", width: 30 },
      ];

      // 과제를 처리하여 시트를 채웁니다.
      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const aiData = await getAIData(assignmentSummary.id);
        const users = assignmentData.assignment;

        const max_slider_value = users.length;

        if (sliderValue > max_slider_value) {
          sliderValue = max_slider_value;
        }

        // 폴더 이름 가져오기
        const firstQuestionImageUrl =
          assignmentData.assignment[0].questions[0].questionImage;
        const folderName = getFolderNameFromImageUrl(firstQuestionImageUrl);

        // metadata.json 경로 생성
        const metadataPath = path.join(
          __dirname,
          "..",
          "..",
          "assets",
          folderName,
          "metadata.json"
        );

        let metadataJson = null;

        try {
          await fs.access(metadataPath);
          // 파일이 존재하면
          const metadataContent = await fs.readFile(metadataPath, "utf8");
          metadataJson = JSON.parse(metadataContent);
          // 'userid' 키 제외
          delete metadataJson["userid"];
        } catch (err) {
          // 파일이 없으면 무시
        }

        // 시간 시트 처리
        for (const user of users) {
          const startTime = user.beforeCanvas.start_time
            ? formatDateTime(user.beforeCanvas.start_time)
            : "";
          const endTime = user.beforeCanvas.end_time
            ? formatDateTime(user.beforeCanvas.end_time)
            : "";
          const duration = user.beforeCanvas.evaluation_time
            ? formatDuration(user.beforeCanvas.evaluation_time)
            : "";

          const row = {
            assignmentId: assignmentSummary.id,
            evaluatorName: user.name,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            aiIndicator: assignmentData.is_ai_use ? "Yes" : "No",
          };

          if (metadataJson) {
            for (const key of Object.keys(metadataJson)) {
              row[key] = metadataJson[key];
            }
          }

          timeSheet.addRow(row);
        }

        // 과제의 시작/종료 시간 계산 (가장 빠른 시작, 가장 늦은 종료)
        const validStartTimes = users
          .filter((u) => u.beforeCanvas.start_time)
          .map((u) => new Date(u.beforeCanvas.start_time));
        const validEndTimes = users
          .filter((u) => u.beforeCanvas.end_time)
          .map((u) => new Date(u.beforeCanvas.end_time));

        const earliestStart = validStartTimes.length > 0
          ? formatDateTime(new Date(Math.min(...validStartTimes)))
          : "";
        const latestEnd = validEndTimes.length > 0
          ? formatDateTime(new Date(Math.max(...validEndTimes)))
          : "";

        // 소요 시간 계산 (모든 평가자의 총 소요 시간)
        const totalDuration = users.reduce((acc, u) => acc + (u.beforeCanvas.evaluation_time || 0), 0);
        const avgDuration = users.length > 0 ? totalDuration / users.length : 0;

        // 결과 시트 처리
        for (const question of assignmentData.assignment[0].questions) {
          const questionImageFileName = question.questionImage.split("/").pop();
          const row = { questionNumber: questionImageFileName };
          row["assignmentId"] = assignmentSummary.id;
          row["startTime"] = earliestStart;
          row["endTime"] = latestEnd;
          row["duration"] = avgDuration > 0 ? formatDuration(Math.round(avgDuration)) : "";

          allEvaluators.forEach((name) => {
            const user = users.find((u) => u.name === name);
            row[name] = user
              ? getValidSquaresCount(user.squares, question.questionId)
              : 0; // 과제에 할당되지 않은 평가자는 0 설정
          });

          // BBox와 Segment 모드 모두 동일한 로직 사용
          if (assignmentData.assignmentMode === "BBox" || assignmentData.assignmentMode === "Segment") {
            const adjustedSquares = await getAdjustedSquares(users, question);
            const relevantAiData = aiData.filter(
              (ai) =>
                ai.questionIndex === question.questionId &&
                ai.score >= score_value
            );

            const { overlapGroups, nonOverlappingGroups } = getOverlapsBBoxes(
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
              mitosis: overlapGroups.map((group) => {
                const x = Math.round(
                  group.reduce((acc, bbox) => acc + bbox.x, 0) / group.length -
                    12.5
                );
                const y = Math.round(
                  group.reduce((acc, bbox) => acc + bbox.y, 0) / group.length -
                    12.5
                );
                return [x, y, 20, 20];
              }),
              hardneg: nonOverlappingGroups.map((group) => {
                const square = group[0];
                return [
                  Math.round(square.x),
                  Math.round(square.y),
                  Math.round(square.width),
                  Math.round(square.height),
                ];
              }),
            });
          }

          // AI-Json 내용 읽기
          const jsonPath = getImageLocalPath(question.questionImage).replace(
            /\.(jpg|png|jpeg)$/i,
            ".json"
          );

          let aiJsonContent = "";

          try {
            const jsonContent = await fs.readFile(jsonPath, "utf8");
            aiJsonContent = jsonContent;
          } catch (error) {
            console.error("Error reading AI json file:", error);
            aiJsonContent = "";
          }

          row["aiJson"] = aiJsonContent;

          resultSheet.addRow(row);
        }
      }

      timeSheet.getRow(1).font = { bold: true };
      resultSheet.getRow(1).font = { bold: true };

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

router.post(
  "/download-searched-assignments-assets",
  authenticateToken,
  async (req, res) => {
    try {
      const assignments = req.body.data;
      const absolutePath = path.join(__dirname, "../../assets");

      // 필요한 폴더 이름들을 수집합니다.
      const folderSet = new Set();

      // 각 과제에 대해 해당하는 이미지들의 폴더를 찾아냅니다.
      for (const assignmentSummary of assignments) {
        const assignmentData = await fetchAssignmentData(assignmentSummary.id);
        const questions = assignmentData.assignment[0].questions;

        for (const question of questions) {
          const imagePath = getImageLocalPath(question.questionImage);
          const folderName = path.basename(path.dirname(imagePath));
          folderSet.add(folderName);
        }
      }

      const folders = Array.from(folderSet);

      // 응답 헤더 설정
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=selected_assets.zip"
      );

      // zip 아카이브를 생성하고 응답에 연결합니다.
      const archive = archiver("zip", {
        zlib: { level: 9 }, // 압축 수준 설정
      });

      // 오류 처리
      archive.on("error", function (err) {
        console.error("Archive error:", err);
        res.status(500).send({ error: err.message });
      });

      // 아카이브 데이터를 응답으로 보냅니다.
      archive.pipe(res);

      // 필요한 폴더만 아카이브에 추가합니다.
      for (const folder of folders) {
        const folderPath = path.join(absolutePath, folder);
        archive.directory(folderPath, folder);
      }

      // 아카이브를 종료하고 전송을 완료합니다.
      archive.finalize();
    } catch (error) {
      console.error("Error generating Assets file:", error);
      // 에러 발생 시 응답이 이미 전송 중인지 확인하고, 그렇지 않다면 에러 응답을 보냅니다.
      if (!res.headersSent) {
        res.status(500).send("Internal Server Error");
      }
    }
  }
);

router.post("/metrics", authenticateToken, async (req, res) => {
  try {
    const { assignmentIds, sliderValue, score_value } = req.body;

    // assignmentIds가 유효한지 확인
    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({ error: "assignmentIds가 필요합니다." });
    }

    let totalTP = 0;
    let totalFP = 0;
    let totalFN = 0;

    // 각 과제에 대해 TP, FP, FN 계산
    for (const assignmentId of assignmentIds) {
      const assignmentData = await fetchAssignmentData(assignmentId);
      const aiData = await getAIData(assignmentId);
      const users = assignmentData.assignment;

      const maxSliderValue = users.length;

      // sliderValue가 최대 평가자 수보다 클 경우 최대 평가자 수로 조정
      const adjustedSliderValue =
        sliderValue > maxSliderValue ? maxSliderValue : sliderValue;

      // 평가자의 squares를 원본 이미지 좌표로 변환
      const evaluatorSquares = await getAdjustedSquaresForMetrics(
        users,
        assignmentData.assignmentMode,
        assignmentId
      );

      // AI 데이터에서 score_value 이상인 값만 필터링
      const aiSquares = aiData.filter(
        (ai) => ai.isAI && ai.score >= score_value
      );

      // TP, FP, FN 계산
      const { TP, FP, FN } = calculateTP_FP_FN(
        evaluatorSquares,
        aiSquares,
        adjustedSliderValue
      );

      totalTP += TP;
      totalFP += FP;
      totalFN += FN;
    }

    // 전체 과제에 대한 평균값 계산
    const Recall = totalTP / (totalTP + totalFN) || 0;
    const Precision = totalTP / (totalTP + totalFP) || 0;
    const F1 = 2 * ((Recall * Precision) / (Recall + Precision)) || 0;

    res.json({
      metrics: [
        {
          totalTP,
          totalFP,
          totalFN,
          Recall,
          Precision,
          F1,
          sliderValue, // 슬라이더 값 포함
          score_value, // 점수 값 포함
        },
      ],
    });
  } catch (error) {
    console.error("Metrics 계산 중 오류 발생:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 추가: Metrics용으로 평가자의 squares를 변환하는 함수
async function getAdjustedSquaresForMetrics(
  users,
  _assignmentMode, // 향후 모드별 분기 처리용으로 유지
  _assignmentId // eslint-disable-line no-unused-vars
) {
  const adjustedSquares = [];

  for (const user of users) {
    for (const question of user.questions) {
      const adjusted = await getAdjustedSquares([user], question);
      adjustedSquares.push(...adjusted);
    }
  }

  return adjustedSquares;
}

function calculateTP_FP_FN(evaluatorSquares, aiSquares, overlapCount) {
  const groups = [];
  const visited = new Set();

  // DFS로 그룹화
  function dfs(square, group) {
    if (visited.has(square)) return;

    visited.add(square);
    group.push(square);

    evaluatorSquares.forEach((otherSquare) => {
      if (
        !visited.has(otherSquare) &&
        Math.abs(square.x - otherSquare.x) <= 12.5 &&
        Math.abs(square.y - otherSquare.y) <= 12.5
      ) {
        dfs(otherSquare, group);
      }
    });
  }

  // 그룹화된 평가자 사각형들
  evaluatorSquares.forEach((square) => {
    if (!visited.has(square)) {
      const group = [];
      dfs(square, group);
      if (group.length >= overlapCount) {
        groups.push(group);
      }
    }
  });

  const overlapGroups = groups;

  // TP: 겹친 평가자 사각형과 AI 사각형이 일치하는 그룹의 수
  let TP = 0;
  overlapGroups.forEach((group) => {
    const matchFound = group.some((bbox) =>
      aiSquares.some(
        (ai) =>
          Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
      )
    );
    if (matchFound) {
      TP++;
    }
  });

  // FN: AI 사각형이 없는 그룹 수
  const FN = overlapGroups.length - TP;

  // FP: AI 사각형은 있지만 해당 위치에 일치하는 그룹이 없는 경우
  let FP = 0;
  aiSquares.forEach((ai) => {
    const matched = overlapGroups.some((group) =>
      group.some(
        (bbox) =>
          Math.abs(bbox.x - ai.x) <= 12.5 && Math.abs(bbox.y - ai.y) <= 12.5
      )
    );
    if (!matched) {
      FP++;
    }
  });

  console.log("TP:", TP);
  console.log("FP:", FP);
  console.log("FN:", FN);

  return { TP, FP, FN };
}

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

function getFolderNameFromImageUrl(imageUrl) {
  const parsedUrl = new URL(imageUrl);
  const pathParts = parsedUrl.pathname.split("/");
  return pathParts[pathParts.length - 2];
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
          width: 20,
          height: 20,
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

  // 오버랩된 박스 추적
  const overlappedSquares = new Set(groups.flat());

  // 오버랩되지 않은 박스 추출
  const nonOverlappingSquares = squares.filter(
    (square) => !overlappedSquares.has(square)
  );

  return {
    overlapGroups: groups,
    nonOverlappingGroups: nonOverlappingSquares.map((square) => [square]),
  };
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
  const [assignmentInfo] = await db.query(
    `SELECT title as FileName, assignment_mode as assignmentMode, is_ai_use FROM assignments WHERE id = ?`,
    [assignmentId]
  );

  const [users] = await db.query(
    `SELECT u.id as userId, u.username as name
     FROM users u
     JOIN assignment_user au ON u.id = au.user_id
     WHERE au.assignment_id = ?`,
    [assignmentId]
  );

  const [questions] = await db.query(
    `SELECT id as questionId, image as questionImage FROM questions WHERE assignment_id = ?`,
    [assignmentId]
  );

  // 이미지 크기 정보 가져오기
  for (let question of questions) {
    const { width, height } = await getImageDimensions(question.questionImage);
    question.originalWidth = width;
    question.originalHeight = height;
  }

  const [responses] = await db.query(
    `SELECT qr.question_id, qr.user_id, qr.selected_option as questionSelection
     FROM question_responses qr
     JOIN questions q ON qr.question_id = q.id
     WHERE q.assignment_id = ?`,
    [assignmentId]
  );

  const [squares] = await db.query(
    `SELECT si.question_id as questionIndex, si.x, si.y, si.user_id, si.isAI, si.isTemporary
     FROM squares_info si
     JOIN questions q ON si.question_id = q.id
     WHERE q.assignment_id = ? AND si.isTemporary = 0`,
    [assignmentId]
  );

  const [canvasInfo] = await db.query(
    `SELECT user_id, width, height, start_time, end_time, evaluation_time FROM canvas_info WHERE assignment_id = ?`,
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
      start_time: null,
      end_time: null,
      evaluation_time: null,
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

  return {
    assignment: structuredData,
    assignmentMode: assignmentInfo[0].assignmentMode,
    FileName: assignmentInfo[0].FileName,
    is_ai_use: assignmentInfo[0].is_ai_use,
  };
}

async function getAIData(assignmentId) {
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
      const parsed = JSON.parse(jsonContent);

      // annotation 필드가 없거나 배열이 아닌 경우 건너뜀
      if (!parsed.annotation || !Array.isArray(parsed.annotation)) {
        continue;
      }

      const bbox = parsed.annotation.map((annotation) => {
        // polygon 형태도 지원 (Segment 모드용)
        let x, y;
        if (annotation.bbox) {
          [x, y] = annotation.bbox;
        } else if (annotation.polygon && annotation.polygon.length > 0) {
          // polygon의 첫 번째 점 사용 (Segment 모드)
          [x, y] = annotation.polygon[0];
        } else {
          return null;
        }

        const score = annotation.score ? annotation.score : 0.6;
        return {
          x: x + 12.5,
          y: y + 12.5,
          questionIndex: question.id,
          score: score,
          isAI: true,
        };
      }).filter(Boolean); // null 제거

      AI_BBOX.push(...bbox);
    } catch (error) {
      // 파일이 없거나 읽을 수 없는 경우 건너뜀
      continue;
    }
  }

  return AI_BBOX;
}

module.exports = router;
