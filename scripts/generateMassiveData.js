const path = require("path");

// 상위 디렉토리의 db.js 파일 참조
const db = require(path.join(__dirname, "..", "server", "db"));

/**
 * MEDIRATE 대규모 실서비스 더미 데이터 생성기
 * 
 * 실제 의료진이 사용하는 것과 같은 수준의 방대한 데이터를 생성합니다.
 * - 사용자: 200명 (관리자 5명, 의사 195명)
 * - 과제: 50개 (다양한 암종과 진단 케이스)
 * - 게시물: 300개 (공지사항, 전문 토론, 케이스 스터디 등)
 * - 댓글: 1000개+ (활발한 커뮤니티 시뮬레이션)
 * - 과제 응답: 수천개 (실제 진단 결과 데이터)
 */

const generateMassiveData = async () => {
  console.log("🏥 MEDIRATE 대규모 실서비스 더미 데이터 생성을 시작합니다...");
  console.log("📊 예상 생성 데이터: 사용자 200명, 과제 50개, 게시물 300개, 댓글 1000개+");
  console.log("⏱️  소요 시간: 약 2-3분");
  console.log("=".repeat(70));

  try {
    // 1. 기존 데이터 완전 초기화
    await clearAllData();
    
    // 2. 대규모 사용자 데이터 생성
    const userIds = await generateMassiveUsers();
    
    // 3. 대규모 과제 데이터 생성
    const assignmentData = await generateMassiveAssignments();
    
    // 4. 과제-사용자 할당 (각 과제당 5명)
    await assignUsersToAssignments(assignmentData.assignmentIds, userIds.doctorIds);
    
    // 5. 질문 데이터 생성
    const questionIds = await generateQuestions(assignmentData);
    
    // 6. 대규모 커뮤니티 데이터 생성
    await generateMassiveCommunityData(userIds);
    
    // 7. 과제 응답 및 평가 데이터 생성
    await generateMassiveResponseData(assignmentData.assignmentIds, questionIds, userIds.doctorIds);
    
    // 8. 캔버스 및 BBox 데이터 생성
    await generateCanvasAndBBoxData(assignmentData.assignmentIds, userIds.doctorIds);
    
    console.log("🎉 대규모 더미 데이터 생성 완료!");
    console.log("=".repeat(70));
    printSummary();
    
  } catch (error) {
    console.error("❌ 대규모 데이터 생성 중 오류 발생:", error);
    throw error;
  }
};

// 기존 데이터 완전 초기화
const clearAllData = async () => {
  console.log("🗑️  기존 데이터 초기화 중...");
  
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  const tables = [
    'squares_info', 'canvas_info', 'question_responses', 'comments', 
    'attachments', 'posts', 'questions', 'assignment_user', 'assignments', 'users'
  ];
  
  for (const table of tables) {
    await db.query(`TRUNCATE TABLE ${table}`);
  }
  await db.query("SET FOREIGN_KEY_CHECKS = 1");
  
  console.log("✅ 기존 데이터 초기화 완료");
};

// 대규모 사용자 데이터 생성 (200명)
const generateMassiveUsers = async () => {
  console.log("👥 대규모 사용자 데이터 생성 중... (200명)");
  
  const hospitals = [
    "서울대학교병원", "연세대학교세브란스병원", "삼성서울병원", "서울아산병원", 
    "고려대학교안암병원", "서울성모병원", "건국대학교병원", "경희대학교병원",
    "중앙대학교병원", "한양대학교병원", "이화여자대학교의료원", "가톨릭대학교서울성모병원",
    "순천향대학교병원", "인하대학교병원", "을지대학교병원", "동국대학교일산병원",
    "차의과학대학교분당차병원", "가천대학교길병원", "원광대학교병원", "단국대학교병원"
  ];
  
  const departments = [
    "병리과", "내과", "외과", "산부인과", "소아과", "정형외과", 
    "신경외과", "흉부외과", "비뇨기과", "이비인후과", "안과", "피부과",
    "정신건강의학과", "재활의학과", "영상의학과", "진단검사의학과"
  ];
  
  const koreanSurnames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "전"];
  const koreanNames = [
    "민수", "지혜", "현우", "소영", "준호", "미경", "동훈", "유진", "상철", "혜진",
    "태영", "은지", "종현", "나영", "승민", "다혜", "재혁", "수빈", "영호", "지은",
    "성민", "아름", "우진", "하늘", "민규", "채원", "도현", "예은", "진우", "서연",
    "한결", "가영", "시우", "연우", "건우", "지유", "준서", "채은", "시원", "유나",
    "윤서", "지민", "예준", "서우", "지훈", "채윤", "도윤", "예린", "건호", "수아"
  ];
  
  const positions = ["전문의", "임상강사", "조교수", "부교수", "교수", "과장", "부장"];
  
  const users = [];
  const userIds = { adminIds: [], doctorIds: [] };
  
  // 관리자 5명 생성
  for (let i = 1; i <= 5; i++) {
    const surname = koreanSurnames[Math.floor(Math.random() * koreanSurnames.length)];
    const name = koreanNames[Math.floor(Math.random() * koreanNames.length)];
    const user = {
      username: `admin${i}`,
      realname: `${surname}${name}`,
      organization: hospitals[Math.floor(Math.random() * hospitals.length)],
      password: `admin${i}123`,
      role: "admin"
    };
    users.push(user);
  }
  
  // 의사 195명 생성
  const usedUsernames = new Set();
  for (let i = 1; i <= 195; i++) {
    const surname = koreanSurnames[Math.floor(Math.random() * koreanSurnames.length)];
    const name = koreanNames[Math.floor(Math.random() * koreanNames.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const position = positions[Math.floor(Math.random() * positions.length)];
    
    let username;
    do {
      const nameEng = `dr_${surname}${name}${i}`.toLowerCase().replace(/\s+/g, '');
      username = nameEng.length > 20 ? nameEng.substring(0, 20) : nameEng;
    } while (usedUsernames.has(username));
    
    usedUsernames.add(username);
    
    const user = {
      username: username,
      realname: `${surname}${name}`,
      organization: `${hospitals[Math.floor(Math.random() * hospitals.length)]} ${department}`,
      password: `${username}123`,
      role: "user"
    };
    users.push(user);
  }
  
  // 사용자 데이터 삽입
  for (const user of users) {
    const query = "INSERT INTO users (username, realname, organization, password, role) VALUES (?, ?, ?, ?, ?)";
    const [result] = await db.query(query, [user.username, user.realname, user.organization, user.password, user.role]);
    
    if (user.role === "admin") {
      userIds.adminIds.push(result.insertId);
    } else {
      userIds.doctorIds.push(result.insertId);
    }
  }
  
  console.log(`✅ 사용자 데이터 생성 완료: 관리자 ${userIds.adminIds.length}명, 의사 ${userIds.doctorIds.length}명`);
  return userIds;
};

// 대규모 과제 데이터 생성 (50개)
const generateMassiveAssignments = async () => {
  console.log("📋 대규모 과제 데이터 생성 중... (50개)");
  
  const cancerTypes = [
    { type: "pancreatic", name: "췌장암", folder: "1-blad-mitof-01E-001" },
    { type: "breast", name: "유방암", folder: "test123" },
    { type: "lung", name: "폐암", folder: "test123 2" },
    { type: "liver", name: "간암", folder: "test1231123123123" },
    { type: "colorectal", name: "대장암", folder: "1st-blad-mitof-01E-001" }
  ];
  
  const selectionTypes = [
    "양성, 악성, 의심",
    "정상, 비정형, 악성",
    "양성, 악성, 전이",
    "정상, 염증, 악성",
    "정상, 선종, 선암",
    "정상, 이형성, 악성",
    "저등급, 고등급, 침윤성"
  ];
  
  const assignmentTitles = [
    "조기 진단을 위한 {cancer} 조직병리 분석",
    "{cancer} 환자의 림프절 전이 평가",
    "{cancer} 조직에서의 분화도 평가 연구",
    "{cancer} 진단을 위한 면역화학염색 분석",
    "{cancer} 환자의 예후 인자 분석",
    "{cancer} 조직의 분자병리학적 특성 연구",
    "{cancer} 조기 발견을 위한 세포진 검사",
    "{cancer} 환자의 치료 반응 평가",
    "{cancer} 조직에서의 혈관침습 평가",
    "{cancer} 진단의 정확도 향상 연구",
    "AI 보조 {cancer} 진단 시스템 평가",
    "{cancer} 조직의 등급 분류 표준화",
    "{cancer} 환자의 생존율 예측 인자",
    "{cancer} 조직에서의 호르몬 수용체 분석",
    "{cancer} 진단을 위한 새로운 바이오마커 연구"
  ];
  
  const assignments = [];
  const assignmentIds = [];
  
  for (let i = 1; i <= 50; i++) {
    const cancer = cancerTypes[Math.floor(Math.random() * cancerTypes.length)];
    const title = assignmentTitles[Math.floor(Math.random() * assignmentTitles.length)]
      .replace("{cancer}", cancer.name);
    
    const creationDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000); // 최근 90일
    const deadline = new Date(creationDate.getTime() + (Math.random() * 60 + 30) * 24 * 60 * 60 * 1000); // 30-90일 후
    
    const assignment = {
      title: title,
      creation_date: creationDate.toISOString().slice(0, 19).replace('T', ' '),
      deadline: deadline.toISOString().split('T')[0],
      assignment_type: cancer.folder,
      selection_type: selectionTypes[Math.floor(Math.random() * selectionTypes.length)],
      assignment_mode: Math.random() > 0.5 ? "BBox" : "TextBox",
      is_score: Math.random() > 0.2, // 80% 확률로 점수 매기기
      is_ai_use: Math.random() > 0.3, // 70% 확률로 AI 사용
      evaluation_time: Math.floor(Math.random() * 3600 + 900) // 15분-75분
    };
    assignments.push(assignment);
  }
  
  // 과제 데이터 삽입
  for (const assignment of assignments) {
    const query = `INSERT INTO assignments (title, creation_date, deadline, assignment_type, selection_type, assignment_mode, is_score, is_ai_use, evaluation_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(query, [
      assignment.title, assignment.creation_date, assignment.deadline,
      assignment.assignment_type, assignment.selection_type, assignment.assignment_mode,
      assignment.is_score, assignment.is_ai_use, assignment.evaluation_time
    ]);
    assignmentIds.push(result.insertId);
  }
  
  console.log("✅ 과제 데이터 생성 완료: 50개");
  return { assignments, assignmentIds, cancerTypes };
};

// 과제-사용자 할당 (각 과제당 5명)
const assignUsersToAssignments = async (assignmentIds, doctorIds) => {
  console.log("🔗 과제-사용자 할당 중... (각 과제당 5명)");
  
  let totalAssignments = 0;
  for (const assignmentId of assignmentIds) {
    const shuffledDoctors = [...doctorIds].sort(() => Math.random() - 0.5);
    const selectedDoctors = shuffledDoctors.slice(0, 5);
    
    for (const doctorId of selectedDoctors) {
      const query = "INSERT INTO assignment_user (assignment_id, user_id) VALUES (?, ?)";
      await db.query(query, [assignmentId, doctorId]);
      totalAssignments++;
    }
  }
  
  console.log(`✅ 과제-사용자 할당 완료: ${totalAssignments}개`);
};

// 질문 데이터 생성
const generateQuestions = async (assignmentData) => {
  console.log("❓ 질문 데이터 생성 중...");
  
  const { assignmentIds, cancerTypes } = assignmentData;
  const questionIds = [];
  
  const imageFiles = {
    "1-blad-mitof-01E-001": ["sample_image_1.png", "sample_image_2.png"],
    "test123": ["test_image.png"],
    "test123 2": [
      "449311-SS14-63993-HE-(2)-0001.jpg", "449311-SS14-63993-HE-(2)-0002.jpg",
      "449311-SS14-63993-HE-(2)-0003.jpg", "SS18-22708_HE-001.jpg", "SS18-22708_HE-002.jpg"
    ],
    "test1231123123123": [
      "SS18-22708_HE-001.jpg", "SS18-22708_HE-002.jpg", "SS18-22708_HE-003.jpg"
    ],
    "1st-blad-mitof-01E-001": ["sample_image_1.png", "sample_image_2.png"]
  };
  
  // 각 과제에 2-5개의 질문 생성
  for (const assignmentId of assignmentIds) {
    const [assignment] = await db.query("SELECT assignment_type FROM assignments WHERE id = ?", [assignmentId]);
    const assignmentType = assignment[0].assignment_type;
    const availableImages = imageFiles[assignmentType] || ["default_image.png"];
    
    const numQuestions = Math.floor(Math.random() * 4) + 2; // 2-5개
    for (let i = 0; i < numQuestions && i < availableImages.length; i++) {
      const imageUrl = `http://localhost:3000/api/assets/${assignmentType}/${availableImages[i]}`;
      const query = "INSERT INTO questions (assignment_id, image) VALUES (?, ?)";
      const [result] = await db.query(query, [assignmentId, imageUrl]);
      questionIds.push(result.insertId);
    }
  }
  
  console.log(`✅ 질문 데이터 생성 완료: ${questionIds.length}개`);
  return questionIds;
};

// 대규모 커뮤니티 데이터 생성 (300개 게시물, 1000+ 댓글)
const generateMassiveCommunityData = async (userIds) => {
  console.log("💬 대규모 커뮤니티 데이터 생성 중... (300개 게시물, 1000+ 댓글)");
  
  const allUserIds = [...userIds.adminIds, ...userIds.doctorIds];
  
  // 공지사항 생성 (15개)
  const notices = await generateNotices(userIds.adminIds);
  
  // 전문 토론 게시물 생성 (100개)
  const discussions = await generateProfessionalDiscussions(userIds.doctorIds);
  
  // 케이스 스터디 게시물 생성 (80개)
  const caseStudies = await generateCaseStudies(userIds.doctorIds);
  
  // 질문 및 답변 게시물 생성 (60개)
  const qnaPosts = await generateQnAPosts(userIds.doctorIds);
  
  // 일반 정보 공유 게시물 생성 (45개)
  const infoPosts = await generateInfoPosts(allUserIds);
  
  const allPosts = [...notices, ...discussions, ...caseStudies, ...qnaPosts, ...infoPosts];
  
  // 댓글 생성 (평균 3-5개 댓글 per 게시물)
  await generateMassiveComments(allPosts, allUserIds);
  
  console.log(`✅ 커뮤니티 데이터 생성 완료: 게시물 ${allPosts.length}개`);
};

// 공지사항 생성
const generateNotices = async (adminIds) => {
  const noticeTemplates = [
    {
      title: "[공지] MEDIRATE 시스템 {version} 업데이트 안내",
      content: "안녕하세요. MEDIRATE 의료 이미지 분석 시스템의 새로운 업데이트가 적용되었습니다.\n\n주요 변경사항:\n- AI 진단 정확도 {accuracy}% 향상\n- 새로운 {feature} 기능 추가\n- 사용자 인터페이스 개선\n- 성능 최적화 및 버그 수정\n\n업데이트 적용 후 새로운 기능들을 활용해 주시기 바랍니다. 문의사항이 있으시면 관리자에게 연락해주세요."
    },
    {
      title: "[공지] 정기 시스템 점검 안내 - {date}",
      content: "시스템 안정성 향상을 위한 정기 점검을 실시합니다.\n\n점검 일시: {date} 오전 2:00 ~ 6:00\n점검 내용:\n- 데이터베이스 최적화\n- 서버 성능 향상\n- 보안 업데이트 적용\n- 백업 시스템 점검\n\n점검 중에는 서비스 이용이 일시적으로 제한될 수 있습니다. 이용에 불편을 드려 죄송합니다."
    },
    {
      title: "[공지] 새로운 {cancer} 진단 AI 모델 도입",
      content: "최신 딥러닝 기술을 적용한 {cancer} 진단 AI 모델이 새롭게 도입되었습니다.\n\n특징:\n- 진단 정확도 {accuracy}% 달성\n- 분석 시간 {time}% 단축\n- 위음성률 대폭 감소\n- 다양한 변이 패턴 인식 가능\n\n해당 모델은 {cancer} 관련 모든 과제에서 활용 가능하며, 기존 진단 프로세스를 보완하는 역할을 합니다."
    },
    {
      title: "[공지] 의료진 교육 프로그램 안내",
      content: "MEDIRATE 시스템 활용도 향상을 위한 의료진 교육 프로그램을 실시합니다.\n\n교육 내용:\n- AI 보조 진단 시스템 활용법\n- 정확한 진단 기준 적용\n- 효율적인 케이스 분석 방법\n- 동료 의료진과의 협업 도구 사용법\n\n참여를 원하시는 분은 관리자에게 신청해 주시기 바랍니다."
    },
    {
      title: "[공지] 데이터 보안 정책 업데이트",
      content: "환자 정보 보호를 위한 데이터 보안 정책이 강화되었습니다.\n\n주요 변경사항:\n- 접근 권한 세분화\n- 로그 모니터링 강화\n- 암호화 수준 향상\n- 정기적인 보안 감사 실시\n\n모든 사용자는 새로운 보안 정책을 숙지하고 준수해 주시기 바랍니다."
    }
  ];
  
  const posts = [];
  for (let i = 0; i < 15; i++) {
    const template = noticeTemplates[Math.floor(Math.random() * noticeTemplates.length)];
    const cancers = ["췌장암", "유방암", "폐암", "간암", "대장암", "위암", "갑상선암"];
    
    const title = template.title
      .replace("{version}", `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`)
      .replace("{date}", new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString())
      .replace("{cancer}", cancers[Math.floor(Math.random() * cancers.length)]);
    
    const content = template.content
      .replace("{version}", `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`)
      .replace("{accuracy}", Math.floor(Math.random() * 10) + 90)
      .replace("{feature}", ["실시간 협업", "음성 인식", "자동 리포트 생성", "모바일 지원"][Math.floor(Math.random() * 4)])
      .replace("{date}", new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString())
      .replace("{cancer}", cancers[Math.floor(Math.random() * cancers.length)])
      .replace("{accuracy}", Math.floor(Math.random() * 5) + 95)
      .replace("{time}", Math.floor(Math.random() * 30) + 50);
    
    const query = "INSERT INTO posts (user_id, title, content, type, creation_date) VALUES (?, ?, ?, ?, NOW())";
    const userId = adminIds[Math.floor(Math.random() * adminIds.length)];
    const [result] = await db.query(query, [userId, title, content, "notice"]);
    posts.push(result.insertId);
  }
  
  return posts;
};

// 전문 토론 게시물 생성
const generateProfessionalDiscussions = async (doctorIds) => {
  const discussionTopics = [
    {
      title: "{cancer} 진단에서 {technique} 기법의 임상적 의의",
      content: "최근 {cancer} 환자에서 {technique} 기법을 적용한 사례가 증가하고 있습니다.\n\n연구 배경:\n{background}\n\n임상 적용 결과:\n{results}\n\n향후 연구 방향:\n{future}\n\n동료 의료진들의 경험과 의견을 공유해 주시면 감사하겠습니다."
    },
    {
      title: "{cancer} 환자의 {marker} 바이오마커 해석",
      content: "{marker} 바이오마커는 {cancer} 진단과 예후 예측에 중요한 역할을 합니다.\n\n정상 범위: {range}\n해석 기준:\n{criteria}\n\n임상적 고려사항:\n{considerations}\n\n실제 케이스에서의 활용 경험을 공유해 주세요."
    },
    {
      title: "AI 보조 진단 시스템의 한계와 개선 방안",
      content: "AI 진단 시스템을 활용하면서 느낀 한계점과 개선이 필요한 부분들을 논의해보고자 합니다.\n\n현재 한계점:\n{limitations}\n\n개선 제안:\n{improvements}\n\n여러분의 경험과 제안사항을 공유해 주세요."
    }
  ];
  
  const posts = [];
  for (let i = 0; i < 100; i++) {
    const template = discussionTopics[Math.floor(Math.random() * discussionTopics.length)];
    const cancers = ["췌장암", "유방암", "폐암", "간암", "대장암"];
    const techniques = ["면역화학염색", "분자병리", "디지털병리", "AI분석", "유전자검사"];
    const markers = ["Ki-67", "HER2", "ER/PR", "p53", "EGFR"];
    
    const title = template.title
      .replace("{cancer}", cancers[Math.floor(Math.random() * cancers.length)])
      .replace("{technique}", techniques[Math.floor(Math.random() * techniques.length)])
      .replace("{marker}", markers[Math.floor(Math.random() * markers.length)]);
    
    const content = template.content
      .replace(/{cancer}/g, cancers[Math.floor(Math.random() * cancers.length)])
      .replace(/{technique}/g, techniques[Math.floor(Math.random() * techniques.length)])
      .replace(/{marker}/g, markers[Math.floor(Math.random() * markers.length)])
      .replace("{background}", "기존 진단 방법의 한계를 극복하고 정확도를 향상시키기 위한 연구")
      .replace("{results}", "진단 정확도 15% 향상, 분석 시간 40% 단축")
      .replace("{future}", "다기관 협력 연구를 통한 대규모 데이터 수집 및 검증")
      .replace("{range}", "0-30% (낮음), 31-70% (중간), 71-100% (높음)")
      .replace("{criteria}", "임상 소견과 함께 종합적으로 판단")
      .replace("{considerations}", "환자의 연령, 병기, 동반 질환 등을 고려")
      .replace("{limitations}", "복합적인 케이스에서의 판단 어려움, 희귀 변이 인식 한계")
      .replace("{improvements}", "더 많은 학습 데이터 필요, 의료진 피드백 반영 시스템 구축");
    
    const query = "INSERT INTO posts (user_id, title, content, type, creation_date) VALUES (?, ?, ?, ?, ?)";
    const userId = doctorIds[Math.floor(Math.random() * doctorIds.length)];
    const creationDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
    const [result] = await db.query(query, [userId, title, content, "post", creationDate]);
    posts.push(result.insertId);
  }
  
  return posts;
};

// 케이스 스터디 게시물 생성
const generateCaseStudies = async (doctorIds) => {
  const caseTemplates = [
    {
      title: "흥미로운 {cancer} 케이스 - {age}세 {gender} 환자",
      content: "환자 정보:\n- 연령: {age}세\n- 성별: {gender}\n- 주호소: {complaint}\n- 가족력: {family_history}\n\n검사 소견:\n{findings}\n\n진단:\n{diagnosis}\n\n치료 계획:\n{treatment}\n\n이 케이스에 대한 의견을 듣고 싶습니다."
    },
    {
      title: "{cancer} 조기 진단 성공 사례",
      content: "조기 발견으로 좋은 예후를 보인 {cancer} 환자 사례를 공유합니다.\n\n발견 경위:\n{discovery}\n\n진단 과정:\n{process}\n\n치료 결과:\n{outcome}\n\n조기 진단의 중요성을 다시 한번 느끼게 되는 케이스입니다."
    }
  ];
  
  const posts = [];
  for (let i = 0; i < 80; i++) {
    const template = caseTemplates[Math.floor(Math.random() * caseTemplates.length)];
    const cancers = ["췌장암", "유방암", "폐암", "간암", "대장암"];
    const ages = Array.from({length: 50}, (_, i) => i + 30);
    const genders = ["남성", "여성"];
    const complaints = ["복부 불편감", "덩어리 촉지", "호흡곤란", "체중 감소", "혈변"];
    
    const title = template.title
      .replace("{cancer}", cancers[Math.floor(Math.random() * cancers.length)])
      .replace("{age}", ages[Math.floor(Math.random() * ages.length)])
      .replace("{gender}", genders[Math.floor(Math.random() * genders.length)]);
    
    const content = template.content
      .replace(/{cancer}/g, cancers[Math.floor(Math.random() * cancers.length)])
      .replace(/{age}/g, ages[Math.floor(Math.random() * ages.length)])
      .replace(/{gender}/g, genders[Math.floor(Math.random() * genders.length)])
      .replace("{complaint}", complaints[Math.floor(Math.random() * complaints.length)])
      .replace("{family_history}", "특이사항 없음")
      .replace("{findings}", "CT상 의심 병변 관찰, 조직검사 시행")
      .replace("{diagnosis}", "조직병리학적으로 확진")
      .replace("{treatment}", "수술적 치료 계획")
      .replace("{discovery}", "정기 검진 중 발견")
      .replace("{process}", "영상 검사 → 조직검사 → 병리 확진")
      .replace("{outcome}", "완전 절제 성공, 추적 관찰 중");
    
    const query = "INSERT INTO posts (user_id, title, content, type, creation_date) VALUES (?, ?, ?, ?, ?)";
    const userId = doctorIds[Math.floor(Math.random() * doctorIds.length)];
    const creationDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
    const [result] = await db.query(query, [userId, title, content, "post", creationDate]);
    posts.push(result.insertId);
  }
  
  return posts;
};

// Q&A 게시물 생성
const generateQnAPosts = async (doctorIds) => {
  const qnaTemplates = [
    {
      title: "{cancer} 진단 시 {question_type} 관련 질문",
      content: "{cancer} 환자 진단 과정에서 {question_type}에 대해 질문드립니다.\n\n상황:\n{situation}\n\n질문:\n{question}\n\n경험이 있으신 선생님들의 조언 부탁드립니다."
    },
    {
      title: "면역화학염색 결과 해석 문의 - {marker}",
      content: "{marker} 면역화학염색 결과 해석에 어려움이 있어 문의드립니다.\n\n염색 조건: {condition}\n결과: {result}\n해석: {interpretation}\n\n이런 경우 어떻게 판단하시는지 의견 부탁드립니다."
    }
  ];
  
  const posts = [];
  for (let i = 0; i < 60; i++) {
    const template = qnaTemplates[Math.floor(Math.random() * qnaTemplates.length)];
    const cancers = ["췌장암", "유방암", "폐암", "간암", "대장암"];
    const questionTypes = ["감별진단", "병기설정", "예후예측", "치료선택"];
    const markers = ["Ki-67", "HER2", "ER", "PR", "p53"];
    
    const title = template.title
      .replace("{cancer}", cancers[Math.floor(Math.random() * cancers.length)])
      .replace("{question_type}", questionTypes[Math.floor(Math.random() * questionTypes.length)])
      .replace("{marker}", markers[Math.floor(Math.random() * markers.length)]);
    
    const content = template.content
      .replace(/{cancer}/g, cancers[Math.floor(Math.random() * cancers.length)])
      .replace("{question_type}", questionTypes[Math.floor(Math.random() * questionTypes.length)])
      .replace("{marker}", markers[Math.floor(Math.random() * markers.length)])
      .replace("{situation}", "비정형적인 조직 소견을 보이는 케이스")
      .replace("{question}", "이런 경우 추가로 시행할 검사나 고려사항이 있을까요?")
      .replace("{condition}", "1:200 희석, 30분 반응")
      .replace("{result}", "부분적으로 양성 반응")
      .replace("{interpretation}", "양성으로 판단하기에는 애매한 상황");
    
    const query = "INSERT INTO posts (user_id, title, content, type, creation_date) VALUES (?, ?, ?, ?, ?)";
    const userId = doctorIds[Math.floor(Math.random() * doctorIds.length)];
    const creationDate = new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000);
    const [result] = await db.query(query, [userId, title, content, "post", creationDate]);
    posts.push(result.insertId);
  }
  
  return posts;
};

// 정보 공유 게시물 생성
const generateInfoPosts = async (allUserIds) => {
  const infoTemplates = [
    {
      title: "{conference} 학회 참석 후기",
      content: "최근 참석한 {conference} 학회에서 얻은 유용한 정보를 공유합니다.\n\n주요 발표 내용:\n{presentations}\n\n새로운 기술:\n{technologies}\n\n인상 깊었던 점:\n{highlights}\n\n관련 자료는 첨부파일로 공유하겠습니다."
    },
    {
      title: "최신 {cancer} 연구 동향",
      content: "최근 발표된 {cancer} 관련 연구 동향을 정리해보았습니다.\n\n주요 연구 결과:\n{results}\n\n임상적 의의:\n{significance}\n\n향후 전망:\n{prospects}\n\n참고문헌도 함께 정리했으니 활용해 주세요."
    }
  ];
  
  const posts = [];
  for (let i = 0; i < 45; i++) {
    const template = infoTemplates[Math.floor(Math.random() * infoTemplates.length)];
    const conferences = ["대한병리학회", "아시아병리학회", "국제암학회", "AI의학회"];
    const cancers = ["췌장암", "유방암", "폐암", "간암", "대장암"];
    
    const title = template.title
      .replace("{conference}", conferences[Math.floor(Math.random() * conferences.length)])
      .replace("{cancer}", cancers[Math.floor(Math.random() * cancers.length)]);
    
    const content = template.content
      .replace("{conference}", conferences[Math.floor(Math.random() * conferences.length)])
      .replace(/{cancer}/g, cancers[Math.floor(Math.random() * cancers.length)])
      .replace("{presentations}", "AI 진단 기술의 최신 동향, 정밀의료 적용 사례")
      .replace("{technologies}", "차세대 염기서열 분석, 액체생검 기술")
      .replace("{highlights}", "실제 임상에서의 적용 가능성과 효과")
      .replace("{results}", "생존율 개선, 조기 진단율 향상")
      .replace("{significance}", "환자 예후 개선에 기여")
      .replace("{prospects}", "개인 맞춤형 치료로의 발전");
    
    const query = "INSERT INTO posts (user_id, title, content, type, creation_date) VALUES (?, ?, ?, ?, ?)";
    const userId = allUserIds[Math.floor(Math.random() * allUserIds.length)];
    const creationDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const [result] = await db.query(query, [userId, title, content, "post", creationDate]);
    posts.push(result.insertId);
  }
  
  return posts;
};

// 대규모 댓글 생성
const generateMassiveComments = async (postIds, allUserIds) => {
  console.log("💬 대규모 댓글 데이터 생성 중...");
  
  const commentTemplates = [
    "좋은 정보 감사합니다. 실제 임상에서 활용해보겠습니다.",
    "저도 비슷한 경험이 있습니다. {experience}",
    "흥미로운 케이스네요. 추가 검사 결과도 궁금합니다.",
    "이런 경우 {suggestion} 방법도 고려해볼 수 있을 것 같습니다.",
    "최신 가이드라인에 따르면 {guideline}입니다.",
    "동일한 소견을 보인 환자에서 {outcome} 결과를 얻었습니다.",
    "참고할 만한 논문을 공유합니다: {reference}",
    "이 케이스에서는 {differential} 감별진단도 중요할 것 같습니다.",
    "AI 진단 결과와 비교해보면 어떨까요?",
    "다기관 연구 데이터를 보면 {data} 경향을 보입니다."
  ];
  
  const professionalTerms = {
    experience: ["유사한 소견", "동일한 결과", "비슷한 예후"],
    suggestion: ["추가 면역화학염색", "분자병리검사", "다학제 논의"],
    guideline: ["표준 치료 프로토콜 적용", "정기적인 추적 관찰", "조기 개입"],
    outcome: ["양호한", "기대 이상의", "만족스러운"],
    reference: ["Nature Medicine 2024", "JCO 최신호", "Lancet Oncology"],
    differential: ["악성 변화", "전이성 병변", "염증성 변화"],
    data: ["생존율 향상", "재발률 감소", "진단 정확도 증가"]
  };
  
  let totalComments = 0;
  
  for (const postId of postIds) {
    const numComments = Math.floor(Math.random() * 8) + 1; // 1-8개 댓글
    const parentComments = [];
    
    // 일반 댓글 생성
    for (let i = 0; i < numComments; i++) {
      let content = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
      
      // 전문 용어 대체
      Object.keys(professionalTerms).forEach(key => {
        if (content.includes(`{${key}}`)) {
          const terms = professionalTerms[key];
          content = content.replace(`{${key}}`, terms[Math.floor(Math.random() * terms.length)]);
        }
      });
      
      const userId = allUserIds[Math.floor(Math.random() * allUserIds.length)];
      const query = "INSERT INTO comments (post_id, user_id, content, parent_comment_id, created_at) VALUES (?, ?, ?, ?, NOW())";
      const [result] = await db.query(query, [postId, userId, content, null]);
      
      parentComments.push(result.insertId);
      totalComments++;
    }
    
    // 대댓글 생성 (30% 확률)
    for (const parentId of parentComments) {
      if (Math.random() < 0.3) {
        const replyTemplates = [
          "@{author} 선생님 의견에 동의합니다.",
          "추가로 {additional} 점도 고려해볼 만합니다.",
          "좋은 지적이네요. 실제로 {experience}했습니다.",
          "해당 방법의 효과는 {effectiveness}로 보고되고 있습니다."
        ];
        
        let replyContent = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
        replyContent = replyContent
          .replace("{author}", "익명")
          .replace("{additional}", ["예후 예측", "부작용 관리", "환자 상담"][Math.floor(Math.random() * 3)])
          .replace("{experience}", ["성공적인 결과를", "좋은 경험을", "만족스러운 결과를"][Math.floor(Math.random() * 3)])
          .replace("{effectiveness}", ["매우 높게", "긍정적으로", "우수하게"][Math.floor(Math.random() * 3)]);
        
        const userId = allUserIds[Math.floor(Math.random() * allUserIds.length)];
        const query = "INSERT INTO comments (post_id, user_id, content, parent_comment_id, created_at) VALUES (?, ?, ?, ?, NOW())";
        await db.query(query, [postId, userId, replyContent, parentId]);
        totalComments++;
      }
    }
  }
  
  console.log(`✅ 댓글 데이터 생성 완료: ${totalComments}개`);
};

// 대규모 과제 응답 데이터 생성
const generateMassiveResponseData = async (assignmentIds, doctorIds, questionIds) => {
  console.log("📝 대규모 과제 응답 데이터 생성 중...");
  
  let totalResponses = 0;
  
  // 각 과제에 할당된 의사들의 응답 생성
  for (const assignmentId of assignmentIds) {
    const [assignedUsers] = await db.query("SELECT user_id FROM assignment_user WHERE assignment_id = ?", [assignmentId]);
    const [questions] = await db.query("SELECT id FROM questions WHERE assignment_id = ?", [assignmentId]);
    
    for (const user of assignedUsers) {
      const userId = user.user_id;
      
      // 80% 확률로 과제 수행
      if (Math.random() < 0.8) {
        for (const question of questions) {
          // 90% 확률로 각 질문에 응답
          if (Math.random() < 0.9) {
            const selectedOption = Math.floor(Math.random() * 3); // 0, 1, 2 (양성, 의심, 악성 등)
            const query = "INSERT INTO question_responses (question_id, user_id, selected_option) VALUES (?, ?, ?)";
            await db.query(query, [question.id, userId, selectedOption]);
            totalResponses++;
          }
        }
      }
    }
  }
  
  console.log(`✅ 과제 응답 데이터 생성 완료: ${totalResponses}개`);
  return totalResponses;
};

// 캔버스 및 BBox 데이터 생성
const generateCanvasAndBBoxData = async (assignmentIds, doctorIds) => {
  console.log("🎨 캔버스 및 BBox 데이터 생성 중...");
  
  const [assignedUsers] = await db.query("SELECT assignment_id, user_id FROM assignment_user");
  
  let totalCanvas = 0;
  let totalBoxes = 0;
  
  for (const assignment of assignedUsers) {
    const startTime = Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null;
    const endTime = startTime && Math.random() > 0.2 ? new Date(startTime.getTime() + Math.random() * 2 * 60 * 60 * 1000) : null;
    const evaluationTime = endTime ? Math.floor((endTime - startTime) / 1000) : 0;
    
    const hasStarted = Math.random() > 0.2; // 80% 확률로 시작
    const width = hasStarted ? Math.floor(Math.random() * 1200 + 800) : 0;
    const height = hasStarted ? Math.floor(Math.random() * 800 + 600) : 0;
    
    const query = `INSERT INTO canvas_info (assignment_id, width, height, lastQuestionIndex, user_id, evaluation_time, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(query, [
      assignment.assignment_id,
      width,
      height,
      Math.floor(Math.random() * 5 + 1),
      assignment.user_id,
      evaluationTime,
      startTime,
      endTime
    ]);
    
    totalCanvas++;
    
    // BBox 데이터 생성 (시작한 캔버스에만)
    if (hasStarted && Math.random() > 0.3) {
      const [questions] = await db.query("SELECT id FROM questions WHERE assignment_id = ?", [assignment.assignment_id]);
      const canvasId = result.insertId;
      
      const numBoxes = Math.floor(Math.random() * 8 + 2); // 2-9개 박스
      for (let i = 0; i < numBoxes && i < questions.length * 3; i++) {
        const questionId = questions[Math.floor(Math.random() * questions.length)].id;
        const isAI = Math.random() > 0.6; // 40% 확률로 AI 생성
        const isTemporary = Math.random() > 0.85; // 15% 확률로 임시
        
        const boxQuery = `INSERT INTO squares_info (question_id, canvas_id, x, y, user_id, isAI, isTemporary) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await db.query(boxQuery, [
          questionId,
          canvasId,
          Math.floor(Math.random() * (width - 100) + 50),
          Math.floor(Math.random() * (height - 100) + 50),
          assignment.user_id,
          isAI ? 1 : 0,
          isTemporary ? 1 : 0
        ]);
        totalBoxes++;
      }
    }
  }
  
  console.log(`✅ 캔버스 데이터 생성 완료: ${totalCanvas}개`);
  console.log(`✅ BBox 데이터 생성 완료: ${totalBoxes}개`);
};

// 최종 요약 출력
const printSummary = () => {
  console.log("📊 MEDIRATE 대규모 실서비스 더미 데이터 생성 완료!");
  console.log("=".repeat(70));
  console.log("🎯 생성된 데이터 요약:");
  console.log("├─ 👥 사용자: 200명 (관리자 5명 + 의사 195명)");
  console.log("├─ 📋 과제: 50개 (다양한 암종별 진단 케이스)");
  console.log("├─ ❓ 질문: 150개+ (과제별 2-5개씩)");
  console.log("├─ 📝 게시물: 300개");
  console.log("│   ├─ 공지사항: 15개");
  console.log("│   ├─ 전문 토론: 100개");
  console.log("│   ├─ 케이스 스터디: 80개");
  console.log("│   ├─ Q&A: 60개");
  console.log("│   └─ 정보 공유: 45개");
  console.log("├─ 💬 댓글: 1000개+");
  console.log("├─ 🎯 과제 할당: 250개 (각 과제당 5명씩)");
  console.log("├─ 📊 과제 응답: 수천개");
  console.log("├─ 🎨 캔버스: 250개");
  console.log("└─ 📦 BBox 데이터: 수백개");
  console.log("=".repeat(70));
  console.log("🔑 로그인 정보:");
  console.log("├─ 관리자: admin1~admin5 / admin[번호]123");
  console.log("└─ 의사: 다양한 이름 / [username]123");
  console.log("=".repeat(70));
  console.log("✨ 특징:");
  console.log("├─ 실제 의료 환경을 반영한 현실적인 데이터");
  console.log("├─ 다양한 암종별 전문적인 케이스");
  console.log("├─ 활발한 커뮤니티 시뮬레이션");
  console.log("├─ AI 보조 진단 데이터 포함");
  console.log("└─ 대규모 실서비스 수준의 데이터량");
  console.log("=".repeat(70));
  console.log("🚀 이제 실제 서비스와 같은 환경에서 테스트하실 수 있습니다!");
};

// 모듈 실행부
if (require.main === module) {
  generateMassiveData()
    .then(() => {
      console.log("🎉 대규모 더미 데이터 생성 작업 완료!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 대규모 더미 데이터 생성 실패:", error);
      process.exit(1);
    });
}

module.exports = generateMassiveData;