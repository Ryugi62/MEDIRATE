// migrateFolderData.js
// 기존 프로젝트 리스트를 Cancer, Folder로 구분하여 DB에 저장하는 스크립트

const fs = require('fs');
const path = require('path');
const db = require('../server/db');

// 폴더명에서 Cancer와 Folder를 추출하는 함수
function extractCancerAndFolder(folderName) {
  console.log(`분석 중인 폴더명: "${folderName}"`);
  
  // 규칙 1: O-2nd로 시작하는 경우 (AI 도움 있음)
  if (folderName.startsWith('O-2nd-')) {
    const parts = folderName.split('-');
    if (parts.length >= 3) {
      const cancer = parts[2]; // u_stmp, net 등
      return { cancer, folder: 'O-2nd' };
    }
  }
  
  // 규칙 2: X-2nd로 시작하는 경우 (AI 도움 없음)
  if (folderName.startsWith('X-2nd-')) {
    const parts = folderName.split('-');
    if (parts.length >= 3) {
      const cancer = parts[2]; // u_stmp, net 등
      return { cancer, folder: 'X-2nd' };
    }
  }
  
  // 규칙 3: 2nd-로 시작하는 경우
  if (folderName.startsWith('2nd-')) {
    const parts = folderName.split('-');
    if (parts.length >= 2) {
      const cancer = parts[1]; // net, gist, brst 등
      return { cancer, folder: '2nd' };
    }
  }
  
  // 규칙 4: 3rd-로 시작하는 경우
  if (folderName.startsWith('3rd-')) {
    const parts = folderName.split('-');
    if (parts.length >= 2) {
      const cancer = parts[1]; // net, gist, brst 등
      return { cancer, folder: '3rd' };
    }
  }
  
  // 규칙 5: 1st-로 시작하는 경우
  if (folderName.startsWith('1st-')) {
    const parts = folderName.split('-');
    if (parts.length >= 2) {
      const cancer = parts[1]; // blad 등
      return { cancer, folder: '1st' };
    }
  }
  
  // 규칙 6: [숫자]-로 시작하는 경우 (예: 1-blad-mitof)
  const numberMatch = folderName.match(/^(\d+)-([a-zA-Z_]+)/);
  if (numberMatch) {
    const cancer = numberMatch[2]; // blad 등
    return { cancer, folder: '1st' };
  }
  
  // 규칙 7: cancer-로 시작하는 패턴 (예: net-100mm-004_2026661)
  const cancerMatch = folderName.match(/^([a-zA-Z_]+)-/);
  if (cancerMatch) {
    const cancer = cancerMatch[1]; // net, brst 등
    return { cancer, folder: '1st' };
  }
  
  // 기본값: 분류 불가능한 경우
  console.log(`⚠️  분류 불가: ${folderName} → 기본값 적용`);
  return { cancer: 'unknown', folder: '1st' };
}

// 현재 assets 폴더의 모든 폴더를 분석하는 함수
async function analyzeFolders() {
  const assetsPath = path.join(__dirname, '../assets');
  
  if (!fs.existsSync(assetsPath)) {
    console.log('❌ assets 폴더가 존재하지 않습니다.');
    return;
  }
  
  const folders = fs.readdirSync(assetsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`📁 총 ${folders.length}개의 폴더를 발견했습니다.`);
  console.log('');
  
  const results = [];
  
  for (const folder of folders) {
    const { cancer, folder: folderType } = extractCancerAndFolder(folder);
    results.push({
      originalName: folder,
      cancer,
      folder: folderType
    });
    
    console.log(`✅ ${folder} → Cancer: ${cancer}, Folder: ${folderType}`);
  }
  
  return results;
}

// 분석 결과를 기반으로 assignments 테이블 업데이트
async function updateAssignments(analysisResults) {
  console.log('');
  console.log('🔄 데이터베이스 업데이트를 시작합니다...');
  
  for (const result of analysisResults) {
    try {
      // 해당 폴더명과 일치하는 assignments 찾기 (title 필드 기준)
      const [existingAssignments] = await db.query(
        'SELECT id, title FROM assignments WHERE title LIKE ?',
        [`%${result.originalName}%`]
      );
      
      if (existingAssignments.length > 0) {
        // 기존 assignments 업데이트
        for (const assignment of existingAssignments) {
          await db.query(
            'UPDATE assignments SET cancer_type = ?, folder_name = ? WHERE id = ?',
            [result.cancer, result.folder, assignment.id]
          );
          console.log(`📝 업데이트됨: Assignment ID ${assignment.id} (${assignment.title})`);
        }
      } else {
        // 새로운 assignment 생성 (assets 폴더는 있지만 DB에 없는 경우)
        console.log(`ℹ️  DB에 없는 폴더: ${result.originalName} → 수동 확인 필요`);
      }
    } catch (error) {
      console.error(`❌ 오류 발생 (${result.originalName}):`, error.message);
    }
  }
}

// 메인 실행 함수
async function main() {
  try {
    console.log('🚀 기존 프로젝트 리스트 폴더화 작업을 시작합니다.');
    console.log('');
    
    // 1. 폴더 분석
    const analysisResults = await analyzeFolders();
    
    if (!analysisResults || analysisResults.length === 0) {
      console.log('❌ 분석할 폴더가 없습니다.');
      return;
    }
    
    // 2. 분석 결과 요약 출력
    console.log('');
    console.log('📊 분석 결과 요약:');
    const summary = {};
    analysisResults.forEach(result => {
      const key = `${result.cancer}/${result.folder}`;
      summary[key] = (summary[key] || 0) + 1;
    });
    
    Object.entries(summary).forEach(([key, count]) => {
      console.log(`   ${key}: ${count}개`);
    });
    
    // 3. 사용자 확인
    console.log('');
    console.log('위 분석 결과로 데이터베이스를 업데이트하시겠습니까? (y/N)');
    
    // 실제 운영에서는 readline을 사용하거나 --force 플래그를 확인
    // 여기서는 자동으로 진행
    console.log('자동으로 업데이트를 진행합니다...');
    
    // 4. DB 업데이트
    await updateAssignments(analysisResults);
    
    console.log('');
    console.log('✅ 작업 1: 기존 프로젝트 리스트 폴더화가 완료되었습니다.');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// 스크립트 직접 실행 시 main 함수 호출
if (require.main === module) {
  main().then(() => {
    console.log('프로세스가 완료되었습니다.');
    process.exit(0);
  }).catch(error => {
    console.error('치명적 오류:', error);
    process.exit(1);
  });
}

module.exports = {
  extractCancerAndFolder,
  analyzeFolders,
  updateAssignments,
  main
};