/**
 * NIPA 박스 데이터 마이그레이션 스크립트
 *
 * 기존 nipa_match_data 테이블에 boxes_json 컬럼을 업데이트합니다.
 * 엑셀 파일의 JSON 컬럼에서 박스 좌표를 추출하여 저장합니다.
 *
 * 사용법: node scripts/migrate-nipa-boxes.js
 */

const xlsx = require('xlsx');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medirate',
  });

  console.log('데이터베이스 연결됨');

  try {
    // boxes_json 컬럼 확인 및 추가
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM nipa_match_data LIKE 'boxes_json'`
    );

    if (columns.length === 0) {
      console.log('boxes_json 컬럼 추가 중...');
      await connection.query(
        `ALTER TABLE nipa_match_data ADD COLUMN boxes_json TEXT DEFAULT NULL`
      );
      console.log('boxes_json 컬럼 추가됨');
    }

    // 박스 데이터 맵: { question_image: { match_2: [...], match_3: [...] } }
    const boxesMap = {};

    // 2인 일치 파일 파싱
    const file2Path = path.join(__dirname, '..', '전체과제-#2인 일치-0.5점.xlsx');
    console.log('2인 일치 파일 파싱 중:', file2Path);

    const workbook2 = xlsx.readFile(file2Path);
    const sheet2 = workbook2.Sheets['결과 Sheet'];

    if (sheet2) {
      const data2 = xlsx.utils.sheet_to_json(sheet2, { header: 1 });
      const header2 = data2[0];

      const questionImageIdx = header2.indexOf('문제 번호');
      const jsonIdx = header2.indexOf('JSON');

      if (questionImageIdx >= 0 && jsonIdx >= 0) {
        for (let i = 1; i < data2.length; i++) {
          const row = data2[i];
          const questionImage = String(row[questionImageIdx] || '');
          const jsonStr = row[jsonIdx];

          if (questionImage && jsonStr) {
            try {
              const jsonData = JSON.parse(jsonStr);
              const boxes = [...(jsonData.mitosis || []), ...(jsonData.hardneg || [])];

              if (!boxesMap[questionImage]) {
                boxesMap[questionImage] = { match_2: [], match_3: [] };
              }
              boxesMap[questionImage].match_2 = boxes;
            } catch (e) {
              // JSON 파싱 실패 시 무시
            }
          }
        }
      }
    }

    console.log('2인 일치 파싱 완료:', Object.keys(boxesMap).length, '개 이미지');

    // 3인 일치 파일 파싱
    const file3Path = path.join(__dirname, '..', '전체과제-#3인 일치-0.5점.xlsx');
    console.log('3인 일치 파일 파싱 중:', file3Path);

    const workbook3 = xlsx.readFile(file3Path);
    const sheet3 = workbook3.Sheets['결과 Sheet'];

    if (sheet3) {
      const data3 = xlsx.utils.sheet_to_json(sheet3, { header: 1 });
      const header3 = data3[0];

      const questionImageIdx = header3.indexOf('문제 번호');
      const jsonIdx = header3.indexOf('JSON');

      if (questionImageIdx >= 0 && jsonIdx >= 0) {
        for (let i = 1; i < data3.length; i++) {
          const row = data3[i];
          const questionImage = String(row[questionImageIdx] || '');
          const jsonStr = row[jsonIdx];

          if (questionImage && jsonStr) {
            try {
              const jsonData = JSON.parse(jsonStr);
              const boxes = [...(jsonData.mitosis || []), ...(jsonData.hardneg || [])];

              if (!boxesMap[questionImage]) {
                boxesMap[questionImage] = { match_2: [], match_3: [] };
              }
              boxesMap[questionImage].match_3 = boxes;
            } catch (e) {
              // JSON 파싱 실패 시 무시
            }
          }
        }
      }
    }

    console.log('3인 일치 파싱 완료');

    // DB 업데이트
    let updateCount = 0;
    for (const [questionImage, boxes] of Object.entries(boxesMap)) {
      const boxesJson = JSON.stringify(boxes);

      const [result] = await connection.query(
        `UPDATE nipa_match_data SET boxes_json = ? WHERE question_image = ?`,
        [boxesJson, questionImage]
      );

      if (result.affectedRows > 0) {
        updateCount++;
      }
    }

    console.log(`마이그레이션 완료: ${updateCount}개 레코드 업데이트됨`);

  } catch (error) {
    console.error('마이그레이션 오류:', error);
  } finally {
    await connection.end();
    console.log('데이터베이스 연결 종료');
  }
}

migrate();
