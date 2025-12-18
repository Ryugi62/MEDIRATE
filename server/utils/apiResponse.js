/**
 * API 응답 유틸리티
 * 일관된 API 응답 형식을 제공합니다.
 */

/**
 * 성공 응답
 * @param {Object} res - Express response 객체
 * @param {*} data - 응답 데이터 (선택)
 * @param {string} message - 응답 메시지 (선택)
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 */
const sendSuccess = (res, data = null, message = null, statusCode = 200) => {
  const response = {};
  if (data !== null) response.data = data;
  if (message) response.message = message;
  return res.status(statusCode).json(response);
};

/**
 * 에러 응답
 * @param {Object} res - Express response 객체
 * @param {number} statusCode - HTTP 상태 코드
 * @param {string} message - 에러 메시지
 * @param {*} details - 추가 에러 정보 (선택)
 */
const sendError = (res, statusCode, message, details = null) => {
  const response = { error: message };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
};

/**
 * 서버 에러 핸들러
 * 콘솔에 에러를 로깅하고 500 응답을 반환합니다.
 * @param {Object} res - Express response 객체
 * @param {string} message - 사용자에게 표시할 에러 메시지
 * @param {Error} error - 원본 에러 객체
 */
const handleServerError = (res, message, error) => {
  console.error(message, error);
  return sendError(res, 500, message);
};

/**
 * HTTP 상태 코드 상수
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
};

/**
 * 권한 검증 유틸리티
 */

/**
 * 소유자 또는 관리자 권한 확인
 * @param {number} resourceUserId - 리소스 소유자 ID
 * @param {number} requestUserId - 요청자 ID
 * @param {string} userRole - 요청자 역할
 * @returns {boolean} 권한 여부
 */
const checkOwnershipOrAdmin = (resourceUserId, requestUserId, userRole) => {
  return resourceUserId === requestUserId || userRole === "admin";
};

/**
 * 권한 검증 실패 시 에러 응답
 * @param {Object} res - Express response 객체
 * @param {string} message - 에러 메시지 (기본값: "권한이 없습니다.")
 */
const sendForbidden = (res, message = "권한이 없습니다.") => {
  return sendError(res, HTTP_STATUS.FORBIDDEN, message);
};

module.exports = {
  sendSuccess,
  sendError,
  handleServerError,
  HTTP_STATUS,
  checkOwnershipOrAdmin,
  sendForbidden,
};
