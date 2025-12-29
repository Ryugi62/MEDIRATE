/**
 * useCanvasEvaluator - 캔버스 평가 컴포넌트용 공통 유틸리티
 *
 * BBoxComponent, SegmentComponent, ConsensusComponent에서 공통으로 사용되는
 * 타이머, 이미지 로딩, 좌표 계산, 확대경 기능을 제공합니다.
 */

/**
 * 캔버스 관련 상수
 */
export const CANVAS_CONSTANTS = {
  // BBox 관련
  SQUARE_SIZE: 25, // 박스 크기
  SQUARE_HALF: 12.5, // 박스 크기의 절반
  CLICK_THRESHOLD: 50, // 클릭 인식 범위
  MIN_DISTANCE: 20, // 박스 간 최소 거리

  // 확대경 관련
  ZOOM_SIZE: 300, // 확대경 크기
  ZOOM_LEVEL: 3.0, // 확대 배율

  // AI 박스 관련
  AI_SQUARE_SIZE: 29, // AI 박스 크기
  AI_SQUARE_HALF: 14.5, // AI 박스 크기의 절반
  AI_OFFSET: 12.5, // AI 좌표 오프셋

  // 중복 체크 관련
  DUPLICATE_THRESHOLD: 5, // 중복 판정 거리

  // Segment 관련
  POLYGON_CLOSE_THRESHOLD: 15, // 폴리곤 닫기 거리

  // Viewer 관련
  GROUP_DISTANCE_THRESHOLD: 12.5, // 박스 그룹화 거리

  // 이미지 오프셋 (확대경 공간 확보용)
  IMAGE_OFFSET: 100, // 이미지를 왼쪽으로 100px 이동

  // Canvas 색상 상수 (하드코딩된 값 중앙 집중화)
  COLORS: {
    // BBox 관련
    TEMPORARY_AI: "#FFD700", // AI 탐지 박스 (Apply 전) - 황금색
    AI: "#00BFFF", // AI Confirm 후 확정된 박스 - 형광 파란색
    MANUAL: "#FF0000", // 전문의 지정 박스 - 빨간색

    // Consensus 관련
    AGREE: "#00FF00", // 동의 - 녹색
    DISAGREE: "#FF0000", // 비동의 - 빨간색
    PENDING: "#FFA500", // 대기중 - 주황색

    // 기타
    HIGHLIGHT: "#FFFF00", // 하이라이트 - 노란색
    BORDER: "#333333", // 테두리 - 진한 회색
  },
};

/**
 * Options API 믹스인 버전
 * Vue Options API 컴포넌트에서 사용할 수 있는 믹스인
 *
 * 사용법:
 * 1. 컴포넌트에서 data에 timer, isRunning, timerInterval, backgroundImage, originalWidth, originalHeight 정의
 * 2. mixins: [canvasEvaluatorMixin] 추가
 * 3. 기존 중복 메서드 제거
 */
export const canvasEvaluatorMixin = {
  computed: {
    formattedTime() {
      const totalSeconds = Math.floor(this.timer / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    },
  },

  methods: {
    // 평가 시작 체크 (중복 코드 통합)
    requireRunning() {
      if (!this.isRunning) {
        this.$toast.warning("평가를 시작해주세요.");
        return false;
      }
      return true;
    },

    // Timer methods
    toggleTimer() {
      if (!this.isRunning) {
        this.startTimer();
      } else {
        this.pauseTimer();
      }
    },

    startTimer() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.timerInterval = setInterval(() => {
        this.timer += 1000;
      }, 1000);
    },

    pauseTimer() {
      if (!this.isRunning) return;
      this.isRunning = false;
      this.clearTimerInterval();
    },

    stopTimer() {
      this.isRunning = false;
      this.clearTimerInterval();
      this.timer = 0;
    },

    clearTimerInterval() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    // Image methods
    createImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (error) => reject(error);
        img.src = src;
      });
    },

    setBackgroundImage(img) {
      this.backgroundImage = img;
      this.originalWidth = img.width;
      this.originalHeight = img.height;
    },

    async loadBackgroundImage() {
      try {
        const img = await this.createImage(this.src);
        this.setBackgroundImage(img);
        this.resizeCanvas();
      } catch (error) {
        console.error("이미지 로드 실패:", error);
      }
    },

    drawBackgroundImage() {
      const canvas = this.$refs.canvas;
      if (!this.backgroundImage || !canvas) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x, y, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      ctx.drawImage(
        this.backgroundImage,
        x,
        y,
        this.backgroundImage.width * scale,
        this.backgroundImage.height * scale
      );
    },

    calculateImagePosition(canvasWidth, canvasHeight) {
      if (!this.originalWidth || !this.originalHeight) {
        return { x: 0, y: 0, scale: 1 };
      }
      const scale = Math.min(
        canvasWidth / this.originalWidth,
        canvasHeight / this.originalHeight
      );
      const x = (canvasWidth - this.originalWidth * scale) / 2;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    // Coordinates methods
    getCanvasCoordinates({ clientX, clientY }) {
      const canvas = this.$refs.canvas;
      if (!canvas) return {};

      const { left, top, width, height } = canvas.getBoundingClientRect();
      return {
        x: (clientX - left) * (canvas.width / width),
        y: (clientY - top) * (canvas.height / height),
      };
    },

    // 캔버스 좌표 → 원본 이미지 좌표 변환
    convertToOriginalCoordinate(canvasX, canvasY) {
      const canvas = this.$refs.canvas;
      if (!canvas) return { x: canvasX, y: canvasY };

      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      return {
        x: (canvasX - imgX) / scale,
        y: (canvasY - imgY) / scale,
      };
    },

    // 원본 이미지 좌표 → 캔버스 좌표 변환
    convertToCanvasCoordinate(originalX, originalY) {
      const canvas = this.$refs.canvas;
      if (!canvas) return { x: originalX, y: originalY };

      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      return {
        x: originalX * scale + imgX,
        y: originalY * scale + imgY,
      };
    },

    // Enlarge methods
    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      if (!this.backgroundImage || !canvas) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 확대경 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const baseZoomSize = 300;
      const zoomLevel = 2.0;
      const zoomWidth = baseZoomSize * scale;
      const zoomHeight = baseZoomSize * scale;

      // 캡처 영역은 고정 (스케일과 무관하게 항상 동일한 영역 표시)
      const sourceWidth = baseZoomSize / zoomLevel;
      const sourceHeight = baseZoomSize / zoomLevel;

      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      const sourceX = mouseXOnImage - sourceWidth / 2;
      const sourceY = mouseYOnImage - sourceHeight / 2;

      // 확대경 위치: 이미지 우측 끝에서 20px * scale 떨어진 곳
      const imageRightEdge = imgX + this.originalWidth * scale;
      const zoomGap = 20 * scale;
      const zoomX = imageRightEdge + zoomGap;

      ctx.save();
      ctx.beginPath();
      ctx.rect(zoomX, 0, zoomWidth, zoomHeight);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        zoomX,
        0,
        zoomWidth,
        zoomHeight
      );

      ctx.restore();
    },
  },

  beforeUnmount() {
    this.clearTimerInterval();
  },
};
