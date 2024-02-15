const jwt = require("jsonwebtoken");

// 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401); // 토큰이 없으면 401 Unauthorized 반환

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // 토큰이 유효하지 않으면 403 Forbidden 반환

    req.user = user; // 요청 객체에 사용자 정보 저장

    next(); // 다음 미들웨어로 이동
  });
}

module.exports = authenticateToken;
