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
        <i
          v-for="icon in iconList"
          :key="icon.name"
          :class="[
            'fas',
            icon.name,
            { active: icon.active },
            { disabled: !isRunning },
          ]"
          @click="handleIconClick(icon)"
          :aria-label="icon.explanation"
        >
          <span class="icon-explanation">({{ icon.explanation }})</span>
        </i>
      </div>

      <div class="segment-component__actions">
        <button @click="commitChanges('segment', goNext)">Save</button>
      </div>
    </div>

    <div class="segment-component__body">
      <canvas
        ref="canvas"
        @click="handleCanvasClick"
        @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave"
        @contextmenu.prevent="handleRightClick"
      ></canvas>
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
export default {
  name: "SegmentComponent",

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
      try {
        const img = await this.createImage(this.src);
        this.setBackgroundImage(img);
        this.resizeCanvas();
      } catch (error) {
        console.error(error);
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

    calculateImagePosition(canvasWidth, canvasHeight) {
      const scale = Math.min(
        canvasWidth / this.originalWidth,
        canvasHeight / this.originalHeight
      );
      const x = (canvasWidth - this.originalWidth * scale) / 2;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      canvas.width = 0;
      canvas.height = 0;

      const body = this.$el.querySelector(".segment-component__body").getBoundingClientRect();
      canvas.width = body.width;
      canvas.height = body.height;

      this.localBeforeCanvas.width = canvas.width;
      this.localBeforeCanvas.height = canvas.height;

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

    addPoint(x, y) {
      // 첫 점 근처를 클릭하면 폴리곤 완성
      if (this.currentPoints.length >= 3) {
        const firstPoint = this.currentPoints[0];
        const distance = Math.hypot(firstPoint.x - x, firstPoint.y - y);
        if (distance < 15) {
          this.completePolygon();
          return;
        }
      }

      this.currentPoints.push({ x, y });
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

    erasePolygon(mouseX, mouseY) {
      const closestPolygon = this.findClosestPolygon(mouseX, mouseY);
      if (closestPolygon) {
        const index = this.temporaryPolygons.indexOf(closestPolygon);
        if (index !== -1) {
          this.temporaryPolygons.splice(index, 1);
        }
        this.redrawCanvas();
      }
    },

    findClosestPolygon(x, y) {
      return this.temporaryPolygons.find((polygon) => {
        if (polygon.questionIndex !== this.questionIndex) return false;
        return this.isPointInPolygon(x, y, polygon.points);
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

    redrawCanvas(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // 완성된 폴리곤 그리기
      this.temporaryPolygons.forEach((polygon) => {
        if (polygon.questionIndex !== this.questionIndex) return;
        this.drawPolygon(ctx, polygon.points, "#FF0000", true);
      });

      // 현재 그리고 있는 폴리곤 그리기
      if (this.currentPoints.length > 0) {
        this.drawPolygon(ctx, this.currentPoints, "#00FF00", false);

        // 각 점에 원 표시
        this.currentPoints.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = index === 0 ? "#FFFF00" : "#00FF00";
          ctx.fill();
        });
      }

      if (event) {
        this.activeEnlarge(event);
      }
    },

    drawPolygon(ctx, points, color, closed) {
      if (points.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      if (closed) {
        ctx.closePath();
        ctx.fillStyle = color + "33";
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    },

    handleCanvasMouseMove(event) {
      if (!this.isRunning) return;
      this.redrawCanvas(event);

      // 현재 그리고 있는 폴리곤의 미리보기 선
      if (this.currentPoints.length > 0) {
        const canvas = this.$refs.canvas;
        const ctx = canvas.getContext("2d");
        const { x, y } = this.getCanvasCoordinates(event);

        ctx.beginPath();
        ctx.moveTo(this.currentPoints[this.currentPoints.length - 1].x, this.currentPoints[this.currentPoints.length - 1].y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },

    handleCanvasMouseLeave() {
      this.redrawCanvas();
    },

    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 300;
      const zoomHeight = 300;
      const zoomLevel = 3.0;

      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      const sourceX = mouseXOnImage - zoomWidth / zoomLevel / 2;
      const sourceY = mouseYOnImage - zoomHeight / zoomLevel / 2;
      const sourceWidth = zoomWidth / zoomLevel;
      const sourceHeight = zoomHeight / zoomLevel;

      if (!this.backgroundImage) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(canvas.width - zoomWidth, 0, zoomWidth, zoomHeight);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        canvas.width - zoomWidth,
        0,
        zoomWidth,
        zoomHeight
      );

      ctx.restore();
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
}

.segment-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  flex-wrap: wrap;
  gap: 8px;
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
  gap: 10px;
}

.icon-list i {
  cursor: pointer;
  padding: 12px;
  font-size: 18px;
  transition: all 0.3s;
  position: relative;
  border-radius: 8px;
}

.icon-list i.disabled {
  pointer-events: none;
  opacity: 0.3;
  color: #ccc !important;
}

.icon-explanation {
  visibility: hidden;
  background-color: black;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px 10px;
  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;
  width: 120px;
}

.icon-list i:hover .icon-explanation {
  visibility: visible;
  opacity: 1;
}

.icon-list i.active {
  color: var(--primary-color, #007bff);
}

.icon-list i:hover {
  color: var(--hover-color, #0056b3);
}

.segment-component__actions {
  display: flex;
  gap: 10px;
}

.segment-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  border: 1px solid #ccc;
  min-height: 550px;
  background-color: #fff;
}

.segment-component__footer {
  padding: 10px;
  color: #333;
  background-color: #f5f5f5;
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.polygon-count {
  font-size: 14px;
}

.segment-component__instructions {
  padding: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin-top: 10px;
  font-size: 12px;
  text-align: center;
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
