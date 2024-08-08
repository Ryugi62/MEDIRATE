const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../jwt");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

// /download-searched-assigments 에 post 요청을 보내면 응답으로 엑셀 파일을 전달해주는 라우터 테스트니까 간단한 응답만 보내주면 됨
router.post(
  "/download-searched-assigments",
  authenticateToken,
  async (req, res) => {
    try {
      const data = req.body.data;

      // 데이터를 워크시트로 변환
      const worksheet = xlsx.utils.json_to_sheet(data);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      // 파일을 임시 디렉토리에 저장
      const filePath = path.join(__dirname, "searched_assignments.xlsx");
      xlsx.writeFile(workbook, filePath);

      // 파일을 클라이언트에 전송
      res.download(filePath, "searched_assignments.xlsx", (err) => {
        if (err) {
          console.error("File download error:", err);
          res.status(500).send("Error downloading file");
        } else {
          // 전송 후 임시 파일 삭제
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

module.exports = router;
