<!-- SegmentComponent.vue -->
<!-- Polygon(다각형) 기반 평가를 위한 컴포넌트 -->

<template>
  <div class="segment-component">
    <div class="segment-component__header">
      <span class="segment-component__header__left">
        <label>
          <input type="checkbox" v-model="showAlert" />
          알림 표시
        </label>
        |
        <label>
          <input type="checkbox" v-model="goNext" />
          Save 시 Next
        </label>
        <template v-if="is_timer">
          |
          <div class="timer-section">
            <div class="timer-display">
              {{ formattedTime }}
            </div>
            <div class="timer-controls">
              <button @click="toggleTimer" class="timer-button">
                {{ isRunning ? "평가중지" : "평가시작" }}
              </button>
            </div>
          </div>
        </template>
      </span>

      <div class="icon-list">
        <div
          v-for="icon in iconList"
          :key="icon.name"
          class="icon-item"
          :class="{
            active: icon.active,
            disabled: !isRunning,
          }"
          @click="handleIconClick(icon)"
          :aria-label="icon.explanation"
        >
          <i :class="['fas', icon.name]"></i>
          <span class="icon-explanation">{{ icon.explanation }}</span>
        </div>
      </div>

      <div class="segment-component__actions">
        <button @click="commitChanges('segment', goNext)">Save</button>
      </div>
    </div>

    <div class="segment-component__body">
      <div class="canvas-container">
        <canvas
          ref="canvas"
          @click="handleCanvasClick"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
          @contextmenu.prevent="handleRightClick"
        ></canvas>
      </div>
      <ZoomLens
        :image="backgroundImage"
        :mouseX="zoomMouseX"
        :mouseY="zoomMouseY"
        :isActive="isZoomActive"
        :width="zoomSize"
        :height="zoomSize"
        :zoomLevel="2.0"
      />
    </div>
    <div class="segment-component__footer">
      <strong>{{ fileName }}</strong>
      <span class="polygon-count">폴리곤: {{ currentPolygonCount }}개</span>
    </div>

    <div class="segment-component__instructions">
      <strong>조작법:</strong>
      왼클릭 = 점 추가 |
      더블클릭/우클릭 = 폴리곤 완성 |
      Ctrl+Z = 마지막 점 취소 |
      Ctrl+D = 전체 삭제
    </div>
  </div>
</template>

<script>
import ZoomLens from "./ZoomLens.vue";

export default {
  name: "SegmentComponent",
  components: {
    ZoomLens,
  },

  props: {
    beforeCanvas: { type: Object, required: true, default: () => ({}) },
    polygons: {
      type: Array,
      required: true,
      default: () => [],
    },
    src: { type: String, required: true, default: "" },
    questionIndex: { type: Number, required: true, default: 0 },
    assignmentType: { type: String, required: true, default: "" },
    assignmentIndex: { type: Number, required: true, default: 0 },
    is_score: { type: Boolean, required: true, default: true },
    is_ai_use: { type: Boolean, required: true, default: true },
    is_timer: { type: Boolean, required: false, default: true },
    evaluation_time: { type: Number, required: false, default: 0 },
  },

  emits: ["update:polygons", "commitAssignmentChanges"],

  data() {
    return {
      iconList: [
        { name: "fa-draw-polygon", active: true, explanation: "그리기" },
        { name: "fa-eraser", active: false, explanation: "삭제" },
        { name: "fa-circle-minus", active: false, explanation: "전체삭제" },
      ],
      localBeforeCanvas: {},
      localPolygons: [],
      temporaryPolygons: [],
      currentPoints: [], // 현재 그리고 있는 폴리곤의 점들
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
      showAlert: false,
      goNext: true,
      timer: 0,
      isRunning: false,
      timerInterval: null,
      // 슬라이드 전환 시 race condition 방지
      currentLoadId: 0,
      isUnmounted: false,
      // 확대경 관련
      zoomMouseX: 0,
      zoomMouseY: 0,
      isZoomActive: false,
      canvasHeight: 280,
    };
  },

  computed: {
    eraserActive() {
      return this.iconList.some(
        (icon) => icon.name === "fa-eraser" && icon.active
      );
    },
    fileName() {
      return this.src.split("/").pop();
    },
    formattedTime() {
      const totalSeconds = Math.floor(this.timer / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    },
    currentPolygonCount() {
      return this.temporaryPolygons.filter(
        (p) => p.questionIndex === this.questionIndex && p.points.length >= 3
      ).length;
    },
    // 확대경 크기 (캔버스 높이의 40%, min 200px ~ max 350px)
    zoomSize() {
      const size = Math.floor(this.canvasHeight * 0.4);
      return Math.max(200, Math.min(350, size));
    },
  },

  methods: {
    handleIconClick(icon) {
      if (!this.isRunning) {
        if (this.showAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }
      this.activateIcon(icon);
    },

    handleHotkeys(event) {
      if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        this.commitChanges("segment", this.goNext);
      } else if (event.ctrlKey && event.key === "z") {
        event.preventDefault();
        this.undoLastPoint();
      } else if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        this.clearAllPolygons();
      }
    },

    async fetchLocalInfo() {
      this.localBeforeCanvas = this.beforeCanvas;
      this.localPolygons = [...this.polygons];
      this.temporaryPolygons = [...this.polygons];

      if (this.timer === 0) {
        this.timer = this.evaluation_time || 0;
      }
    },

    activateIcon(selectedIcon) {
      if (selectedIcon.name === "fa-circle-minus") {
        if (this.showAlert && !confirm("정말로 모든 폴리곤을 삭제하시겠습니까?")) {
          return;
        }
        this.clearAllPolygons();
        return;
      }

      this.iconList = this.iconList.map((icon) => ({
        ...icon,
        active: icon === selectedIcon,
      }));
      this.redrawCanvas();
    },

    clearAllPolygons() {
      this.temporaryPolygons = this.temporaryPolygons.filter(
        (p) => p.questionIndex !== this.questionIndex
      );
      this.currentPoints = [];
      this.redrawCanvas();
    },

    undoLastPoint() {
      if (this.currentPoints.length > 0) {
        this.currentPoints.pop();
        this.redrawCanvas();
      }
    },

    async loadBackgroundImage() {
      const loadId = ++this.currentLoadId;

      if (!this.src) return;

      try {
        const img = await this.createImage(this.src);

        // 로드 완료 시 현재 로드인지 확인 (stale 로드 방지)
        if (loadId !== this.currentLoadId || this.isUnmounted) {
          return;
        }

        this.setBackgroundImage(img);
        this.resizeCanvas();
      } catch (error) {
        if (loadId !== this.currentLoadId || this.isUnmounted) return;
        console.error("이미지 로드 오류:", error);
      }
    },

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

    calculateImagePosition(canvasWidth) {
      // 0으로 나누기 방지
      if (!this.originalWidth || !this.originalHeight) {
        return { x: 0, y: 0, scale: 1 };
      }

      // 캔버스가 이미지 크기에 맞춰져 있으므로 scale = canvasWidth / originalWidth
      const scale = canvasWidth / this.originalWidth;
      return { x: 0, y: 0, scale };
    },

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      // 이미지가 로드되지 않은 경우 조기 반환
      if (!this.originalWidth || !this.originalHeight) return;

      // DOM 레이아웃이 완료될 때까지 대기
      await this.$nextTick();

      // 부모 컨테이너(.segment-component__body)에서 크기 측정
      const body = this.$el.querySelector(".segment-component__body");
      if (!body) return;
      const bodyRect = body.getBoundingClientRect();

      // 가용 크기 계산 (ZoomLens 크기 + gap 제외)
      const zoomLensWidth = this.zoomSize || 200;
      const gap = 10;
      const availableWidth = bodyRect.width - zoomLensWidth - gap;
      const availableHeight = bodyRect.height;

      // 이미지 비율에 맞게 캔버스 크기 계산
      const scaleX = availableWidth / this.originalWidth;
      const scaleY = availableHeight / this.originalHeight;
      const scale = Math.min(scaleX, scaleY);
      canvas.width = Math.floor(this.originalWidth * scale);
      canvas.height = Math.floor(this.originalHeight * scale);

      // 결과 저장
      this.localBeforeCanvas.width = canvas.width;
      this.localBeforeCanvas.height = canvas.height;
      this.canvasHeight = canvas.height;

      this.drawBackgroundImage();
      this.redrawCanvas();
    },

    getCanvasCoordinates({ clientX, clientY }) {
      const canvas = this.$refs.canvas;
      if (!canvas) return {};

      const { left, top, width, height } = canvas.getBoundingClientRect();
      return {
        x: (clientX - left) * (canvas.width / width),
        y: (clientY - top) * (canvas.height / height),
      };
    },

    handleCanvasClick(event) {
      if (!this.isRunning) {
        if (this.showAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }

      const { x, y } = this.getCanvasCoordinates(event);

      // 이미지 영역 밖 클릭 방지
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imgWidth = this.originalWidth * scale;
      const imgHeight = this.originalHeight * scale;

      if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
        return; // 이미지 영역 밖이면 무시
      }

      if (this.eraserActive) {
        this.erasePolygon(x, y);
      } else {
        this.addPoint(x, y);
      }
    },

    handleRightClick() {
      if (!this.isRunning) return;

      // 우클릭으로 폴리곤 완성
      if (this.currentPoints.length >= 3) {
        this.completePolygon();
      }
    },

    addPoint(canvasX, canvasY) {
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const originalX = (canvasX - imgX) / scale;
      const originalY = (canvasY - imgY) / scale;

      // 첫 점 근처를 클릭하면 폴리곤 완성
      if (this.currentPoints.length >= 3) {
        const POLYGON_CLOSE_THRESHOLD = 15; // 원본 좌표 기준 거리

        const firstPoint = this.currentPoints[0];
        const distance = Math.hypot(firstPoint.x - originalX, firstPoint.y - originalY);
        if (distance < POLYGON_CLOSE_THRESHOLD) {
          this.completePolygon();
          return;
        }
      }

      // 원본 이미지 좌표로 저장
      this.currentPoints.push({ x: originalX, y: originalY });
      this.redrawCanvas();
    },

    completePolygon() {
      if (this.currentPoints.length < 3) {
        if (this.showAlert) {
          alert("폴리곤은 최소 3개의 점이 필요합니다.");
        }
        return;
      }

      this.temporaryPolygons.push({
        questionIndex: this.questionIndex,
        points: [...this.currentPoints],
        isTemporary: false,
      });

      this.currentPoints = [];
      this.redrawCanvas();
    },

    erasePolygon(canvasX, canvasY) {
      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const originalX = (canvasX - imgX) / scale;
      const originalY = (canvasY - imgY) / scale;

      const closestPolygon = this.findClosestPolygon(originalX, originalY);
      if (closestPolygon) {
        const index = this.temporaryPolygons.indexOf(closestPolygon);
        if (index !== -1) {
          this.temporaryPolygons.splice(index, 1);
        }
        this.redrawCanvas();
      }
    },

    findClosestPolygon(originalX, originalY) {
      return this.temporaryPolygons.find((polygon) => {
        if (polygon.questionIndex !== this.questionIndex) return false;
        return this.isPointInPolygon(originalX, originalY, polygon.points);
      });
    },

    isPointInPolygon(x, y, points) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x,
          yi = points[i].y;
        const xj = points[j].x,
          yj = points[j].y;

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    },

    redrawCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      this.drawBackgroundImage();
      const ctx = canvas.getContext("2d");
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 완성된 폴리곤 그리기 (원본 좌표 → 캔버스 좌표 변환)
      this.temporaryPolygons.forEach((polygon) => {
        if (polygon.questionIndex !== this.questionIndex) return;
        const canvasPoints = polygon.points.map(p => ({
          x: imgX + p.x * scale,
          y: imgY + p.y * scale
        }));
        this.drawPolygon(ctx, canvasPoints, "#FF0000", true, scale);
      });

      // 현재 그리고 있는 폴리곤 그리기 (원본 좌표 → 캔버스 좌표 변환)
      if (this.currentPoints.length > 0) {
        const canvasPoints = this.currentPoints.map(p => ({
          x: imgX + p.x * scale,
          y: imgY + p.y * scale
        }));
        this.drawPolygon(ctx, canvasPoints, "#00FF00", false, scale);

        // 각 점에 원 표시
        canvasPoints.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5 * scale, 0, Math.PI * 2);
          ctx.fillStyle = index === 0 ? "#FFFF00" : "#00FF00";
          ctx.fill();
        });
      }

    },

    drawPolygon(ctx, canvasPoints, color, closed, scale = 1) {
      if (canvasPoints.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);

      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
      }

      if (closed) {
        ctx.closePath();
        ctx.fillStyle = color + "33";
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    },

    handleCanvasMouseMove(event) {
      if (!this.isRunning || this.isUnmounted) return;

      const canvas = this.$refs.canvas;
      if (!canvas) return;

      const { x, y } = this.getCanvasCoordinates(event);
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 확대경 업데이트 (원본 이미지 좌표로 변환)
      const mouseXOnImage = x / scale;
      const mouseYOnImage = y / scale;

      // 이미지 영역 내에서만 확대경 표시
      if (mouseXOnImage >= 0 && mouseXOnImage <= this.originalWidth &&
          mouseYOnImage >= 0 && mouseYOnImage <= this.originalHeight) {
        this.zoomMouseX = mouseXOnImage;
        this.zoomMouseY = mouseYOnImage;
        this.isZoomActive = true;
      } else {
        this.isZoomActive = false;
      }

      this.redrawCanvas();

      // 현재 그리고 있는 폴리곤의 미리보기 선
      if (this.currentPoints.length > 0) {
        const ctx = canvas.getContext("2d");

        // 마지막 점을 원본 좌표에서 캔버스 좌표로 변환
        const lastPoint = this.currentPoints[this.currentPoints.length - 1];
        const lastCanvasX = lastPoint.x * scale;
        const lastCanvasY = lastPoint.y * scale;

        ctx.beginPath();
        ctx.moveTo(lastCanvasX, lastCanvasY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 1 * scale;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },

    handleCanvasMouseLeave() {
      this.isZoomActive = false;
      this.redrawCanvas();
    },

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

    clearTimerInterval() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    commitChanges(type, goNext) {
      this.localPolygons = [...this.temporaryPolygons];
      this.$emit("update:polygons", this.localPolygons);
      this.$emit("commitAssignmentChanges", type, goNext, this.timer);
    },
  },

  mounted() {
    this.fetchLocalInfo();
    this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
    window.addEventListener("keydown", this.handleHotkeys);

    if (this.evaluation_time) {
      this.timer = this.evaluation_time;
    }

    if (!this.is_timer) {
      this.isRunning = true;
    }
  },

  beforeUnmount() {
    this.isUnmounted = true;
    this.currentLoadId++;  // 진행 중인 로드 무효화
    window.removeEventListener("resize", this.resizeCanvas);
    window.removeEventListener("keydown", this.handleHotkeys);
    this.clearTimerInterval();
  },

  watch: {
    src: {
      immediate: true,
      handler: async function (newVal, oldVal) {
        if (newVal !== oldVal) {
          await this.loadBackgroundImage();
          await this.fetchLocalInfo();
          this.resizeCanvas();
        }
      },
    },
  },
};
</script>

<style scoped>
.segment-component {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 8px;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.segment-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.segment-component__header__left {
  gap: 8px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  flex-wrap: wrap;
}

.segment-component__header label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.icon-list {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-item {
  cursor: pointer;
  padding: 6px 8px;
  transition: all 0.3s;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #888;
}

.icon-item i {
  font-size: 18px;
}

.icon-item.disabled {
  pointer-events: none;
  opacity: 0.3;
  color: #ccc !important;
}

.icon-explanation {
  font-size: 10px;
  color: inherit;
  white-space: nowrap;
}

.icon-item.active {
  color: var(--primary-color, #007bff);
}

.icon-item:hover {
  color: var(--hover-color, #0056b3);
}

.segment-component__actions {
  display: flex;
  gap: 10px;
}

.segment-component__body {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
  align-items: flex-start;
}

.canvas-container {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  overflow: hidden;
}

.zoom-lens {
  flex-shrink: 0;
}

canvas {
  border: 1px solid #ccc;
  background-color: white;
}

.zoom-lens {
  flex-shrink: 0;
}

.segment-component__footer {
  padding: 4px 10px;
  color: #333;
  background-color: #f5f5f5;
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.polygon-count {
  font-size: 14px;
}

.segment-component__instructions {
  padding: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin-top: 0;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}

/* 타이머 섹션 스타일 */
.timer-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.timer-display {
  font-weight: bold;
  font-size: 18px;
  color: #333;
}

.timer-controls {
  display: flex;
  gap: 8px;
}

.timer-button {
  background-color: var(--primary-color, #007bff);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-button:disabled {
  background-color: var(--gray, #6c757d);
  cursor: not-allowed;
}

.timer-button:not(:disabled):hover {
  background-color: #0056b3;
}
</style>
