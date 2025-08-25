// folderClassifier.js
// 폴더명을 분석하여 Cancer Type과 Folder Name으로 분류하는 유틸리티

/**
 * 폴더명에서 Cancer와 Folder를 추출하는 함수
 * @param {string} folderName - 분석할 폴더명
 * @returns {Object} { cancer: string, folder: string }
 */
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

module.exports = {
  extractCancerAndFolder
};