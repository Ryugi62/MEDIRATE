<!-- ConsensusComponent.vue -->
<!-- FP 사각형에 대한 동의/비동의 평가를 위한 컴포넌트 -->

<template>
  <div class="consensus-component">
    <div class="consensus-component__header">
      <span class="consensus-component__header__left">
        <label>
          <input type="checkbox" v-model="showAlert" />
          알림 표시
        </label>
        |
        <label>
          <input type="checkbox" v-model="goNext" />
          Save 시 Next
        </label>
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
      </span>

      <div class="legend">
        <span class="legend-item pending">미응답</span>
        <span class="legend-item agree">동의 (논 마이토시스)</span>
        <span class="legend-item disagree">비동의 (마이토시스)</span>
      </div>

      <div class="consensus-component__actions">
        <button @click="agreeAll" :disabled="!isRunning" class="action-btn agree-btn">
          전체 동의 (Space)
        </button>
        <button @click="disagreeAll" :disabled="!isRunning" class="action-btn disagree-btn">
          전체 비동의 (Shift+Space)
        </button>
        <button @click="commitChanges" class="save-btn">Save</button>
      </div>
    </div>

    <div class="consensus-component__body">
      <canvas
        ref="canvas"
        @click="handleCanvasClick"
        @contextmenu.prevent="handleRightClick"
        @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave"
        :class="{ 'canvas-disabled': !isRunning }"
      ></canvas>
    </div>

    <div class="consensus-component__footer">
      <strong>{{ fileName }}</strong>
      <span class="response-count">
        응답: {{ respondedCount }} / {{ totalFpCount }}
      </span>
    </div>

    <div class="consensus-component__instructions">
      <strong>조작법:</strong>
      왼클릭 = 동의 (논 마이토시스) |
      우클릭 = 비동의 (마이토시스) |
      Space = 전체 동의 |
      Shift+Space = 전체 비동의
    </div>
  </div>
</template>

<script>
export default {
  name: "ConsensusComponent",

  props: {
    fpSquares: {
      type: Array,
      required: true,
      default: () => [],
    },
    responses: {
      type: Object,
      required: true,
      default: () => ({}),
    },
    src: {
      type: String,
      required: true,
      default: "",
    },
    questionImage: {
      type: String,
      required: true,
      default: "",
    },
    canvasInfo: {
      type: Object,
      required: true,
      default: () => ({}),
    },
    evaluation_time: {
      type: Number,
      required: false,
      default: 0,
    },
    evaluatorCount: {
      type: Number,
      required: false,
      default: 3,
    },
    threshold: {
      type: Number,
      required: false,
      default: 2,
    },
    evaluators: {
      type: Array,
      required: false,
      default: () => [],
    },
    evaluatorResponses: {
      type: Object,
      required: false,
      default: () => ({}),
    },
  },

  emits: ["commitConsensusChanges"],

  data() {
    return {
      localResponses: {},
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
      showAlert: false,
      goNext: true,
      timer: 0,
      isRunning: false,
      timerInterval: null,
      localCanvasInfo: {},
    };
  },

  computed: {
    fileName() {
      return this.questionImage || this.src.split("/").pop();
    },

    formattedTime() {
      const totalSeconds = Math.floor(this.timer / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    },

    currentImageFpSquares() {
      return this.fpSquares.filter(
        (fp) => fp.question_image === this.questionImage
      );
    },

    totalFpCount() {
      return this.currentImageFpSquares.length;
    },

    respondedCount() {
      return this.currentImageFpSquares.filter(
        (fp) => this.localResponses[fp.id]
      ).length;
    },

    isSliderActive() {
      return this.$store.getters.isSlideBarOpen;
    },
  },

  methods: {
    async fetchLocalInfo() {
      this.localResponses = { ...this.responses };
      this.localCanvasInfo = { ...this.canvasInfo };

      if (this.timer === 0) {
        this.timer = this.evaluation_time || 0;
      }
    },

    async loadBackgroundImage() {
      if (!this.src) {
        return;
      }
      try {
        const img = await this.createImage(this.src);
        this.setBackgroundImage(img);
        this.resizeCanvas();
      } catch (error) {
        console.error("이미지 로드 오류:", error);
        console.error("요청 URL:", this.src);
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

      const { x, y, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
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
      // 확대경(우측 상단)과 겹치지 않도록 이미지를 왼쪽으로 100px 이동
      const imageOffset = 100;
      const x = (canvasWidth - this.originalWidth * scale) / 2 - imageOffset;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      canvas.width = 0;
      canvas.height = 0;

      const bboxBody = this.$el
        .querySelector(".consensus-component__body")
        .getBoundingClientRect();
      canvas.width = bboxBody.width;
      canvas.height = bboxBody.height;

      this.localCanvasInfo.width = canvas.width;
      this.localCanvasInfo.height = canvas.height;

      this.drawBackgroundImage();
      this.redrawSquares();
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

    originalToCanvasCoordinates(originalX, originalY) {
      const canvas = this.$refs.canvas;
      const { x, y, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      return {
        canvasX: originalX * scale + x,
        canvasY: originalY * scale + y,
      };
    },

    findClosestFpSquare(canvasX, canvasY) {
      let closest = null;
      let minDistance = Infinity;

      this.currentImageFpSquares.forEach((fp) => {
        const { canvasX: fpCanvasX, canvasY: fpCanvasY } =
          this.originalToCanvasCoordinates(fp.x + 12.5, fp.y + 12.5);
        const distance = Math.hypot(fpCanvasX - canvasX, fpCanvasY - canvasY);

        if (distance <= 50 && distance < minDistance) {
          closest = fp;
          minDistance = distance;
        }
      });

      return closest;
    },

    handleCanvasClick(event) {
      if (!this.isRunning) {
        if (this.showAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }

      const { x, y } = this.getCanvasCoordinates(event);
      const closestFp = this.findClosestFpSquare(x, y);

      if (closestFp) {
        this.localResponses[closestFp.id] = "agree";
        this.redrawSquares();
      }
    },

    handleRightClick(event) {
      if (!this.isRunning) {
        if (this.showAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }

      const { x, y } = this.getCanvasCoordinates(event);
      const closestFp = this.findClosestFpSquare(x, y);

      if (closestFp) {
        this.localResponses[closestFp.id] = "disagree";
        this.redrawSquares();
      }
    },

    agreeAll() {
      if (!this.isRunning) {
        if (this.showAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }

      this.currentImageFpSquares.forEach((fp) => {
        this.localResponses[fp.id] = "agree";
      });
      this.redrawSquares();
    },

    disagreeAll() {
      if (!this.isRunning) {
        if (this.showAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }

      this.currentImageFpSquares.forEach((fp) => {
        this.localResponses[fp.id] = "disagree";
      });
      this.redrawSquares();
    },

    redrawSquares(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      this.currentImageFpSquares.forEach((fp) => {
        const response = this.localResponses[fp.id];
        const { canvasX, canvasY } = this.originalToCanvasCoordinates(
          fp.x + 12.5,
          fp.y + 12.5
        );

        // 색상 결정
        let color;
        let fillAlpha = 0;
        if (response === "agree") {
          color = "#00FF00"; // 녹색 - 동의 (FP 확정)
          fillAlpha = 0.2;
        } else if (response === "disagree") {
          color = "#FF0000"; // 빨강 - 비동의 (TP로 변경)
          fillAlpha = 0.2;
        } else {
          color = "#FFA500"; // 주황 - 미응답
          fillAlpha = 0;
        }

        // 배경 채우기 (응답된 경우)
        if (fillAlpha > 0) {
          ctx.fillStyle = color;
          ctx.globalAlpha = fillAlpha;
          ctx.fillRect(canvasX - 12.5, canvasY - 12.5, 25, 25);
          ctx.globalAlpha = 1;
        }

        // 테두리 그리기
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(canvasX - 12.5, canvasY - 12.5, 25, 25);

        // AI 점수 표시
        ctx.font = "bold 10px Arial";
        ctx.fillStyle = color;
        ctx.fillText(
          parseFloat(fp.ai_score || 0).toFixed(2),
          canvasX - 10,
          canvasY + 22
        );

        // 동의 수 배지 표시 (fp에 agree_count가 있을 때)
        if (fp.agree_count !== undefined && fp.agree_count > 0) {
          const badgeText = `${fp.agree_count}/${this.evaluatorCount}`;
          const isGoldStandard = fp.is_gold_standard;

          // 배지 배경
          ctx.fillStyle = isGoldStandard ? "#4caf50" : "#666";
          ctx.fillRect(canvasX + 8, canvasY - 22, 22, 14);

          // 배지 텍스트
          ctx.font = "bold 9px Arial";
          ctx.fillStyle = "#fff";
          ctx.fillText(badgeText, canvasX + 10, canvasY - 12);
        }

        // 개별 평가자 응답 마커 표시
        if (this.evaluators.length > 0 && this.evaluatorResponses[fp.id]) {
          const markerSize = 6;
          const markerSpacing = 8;
          const startX = canvasX - (this.evaluators.length * markerSpacing) / 2 + 4;
          const startY = canvasY + 34; // AI 점수 아래에 표시

          this.evaluators.forEach((evaluator, idx) => {
            const evalResponse = this.evaluatorResponses[fp.id][evaluator.id];
            let markerColor;
            if (evalResponse) {
              markerColor = evalResponse.response === "agree" ? "#28a745" : "#dc3545";
            } else {
              markerColor = "#999";
            }

            ctx.fillStyle = markerColor;
            ctx.beginPath();
            ctx.arc(startX + idx * markerSpacing, startY, markerSize / 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });

      // 마우스 호버 시 확대 영역 (평가 시작 후에만)
      if (event && this.isRunning) {
        this.activeEnlarge(event);
        this.activeSquareCursor(event);
      }
    },

    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 300;
      const zoomHeight = 300;
      const zoomLevel = 3.0;

      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      const sourceX = mouseXOnImage - zoomWidth / zoomLevel / 2;
      const sourceY = mouseYOnImage - zoomHeight / zoomLevel / 2;
      const sourceWidth = zoomWidth / zoomLevel;
      const sourceHeight = zoomHeight / zoomLevel;

      if (!this.backgroundImage) return;

      // 확대경 위치: 이미지 우측 끝에서 20px 떨어진 곳
      const imageRightEdge = imgX + this.originalWidth * scale;
      const zoomX = imageRightEdge + 20;

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

    activeSquareCursor(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      // 가장 가까운 FP 찾기
      const closestFp = this.findClosestFpSquare(x, y);

      if (closestFp) {
        const { canvasX, canvasY } = this.originalToCanvasCoordinates(
          closestFp.x + 12.5,
          closestFp.y + 12.5
        );

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#00FFFF"; // cyan 하이라이트
        ctx.strokeRect(canvasX - 12.5, canvasY - 12.5, 25, 25);
      }
    },

    handleCanvasMouseMove(event) {
      if (!this.isRunning) return;
      this.redrawSquares(event);
    },

    handleCanvasMouseLeave() {
      this.redrawSquares();
    },

    handleKeydown(event) {
      if (event.code === "Space") {
        event.preventDefault();
        if (event.shiftKey) {
          this.disagreeAll();
        } else {
          this.agreeAll();
        }
      } else if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        this.commitChanges();
      }
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

    commitChanges() {
      this.$emit("commitConsensusChanges", {
        responses: this.localResponses,
        evaluation_time: this.timer,
        canvas_info: {
          width: this.localCanvasInfo.width || 0,
          height: this.localCanvasInfo.height || 0,
        },
        goNext: this.goNext,
      });
    },
  },

  mounted() {
    this.fetchLocalInfo();
    this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
    window.addEventListener("keydown", this.handleKeydown);

    if (this.evaluation_time) {
      this.timer = this.evaluation_time;
    }
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
    window.removeEventListener("keydown", this.handleKeydown);
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

    responses: {
      deep: true,
      handler(newVal) {
        this.localResponses = { ...newVal };
        this.redrawSquares();
      },
    },

    isSliderActive() {
      this.resizeCanvas();
    },
  },
};
</script>

<style scoped>
.consensus-component {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 8px;
  min-height: 0;
  overflow: hidden;
}

.consensus-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.consensus-component__header__left {
  gap: 6px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: 12px;
}

.consensus-component__header label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 15px;
}

.legend-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.legend-item::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 5px;
  border: 2px solid;
}

.legend-item.pending::before {
  border-color: #ffa500;
}

.legend-item.agree::before {
  border-color: #00ff00;
  background-color: rgba(0, 255, 0, 0.2);
}

.legend-item.disagree::before {
  border-color: #ff0000;
  background-color: rgba(255, 0, 0, 0.2);
}

.consensus-component__actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: background-color 0.3s;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background-color: #ccc !important;
}

.agree-btn {
  background-color: #28a745;
  color: white;
}

.agree-btn:not(:disabled):hover {
  background-color: #218838;
}

.disagree-btn {
  background-color: #dc3545;
  color: white;
}

.disagree-btn:not(:disabled):hover {
  background-color: #c82333;
}

.save-btn {
  background-color: var(--primary-color, #007bff);
  color: white;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.save-btn:hover {
  background-color: #0056b3;
}

.consensus-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
  overflow: hidden;
}

canvas {
  border: 1px solid #ccc;
  max-width: 100%;
  max-height: 100%;
  transition: border 0.3s;
  background-color: #fff;
  cursor: crosshair;
}

canvas.canvas-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

canvas:not(.canvas-disabled):hover {
  border: 1px solid var(--primary-color, #007bff);
}

.consensus-component__footer {
  padding: 6px 10px;
  color: #333;
  background-color: #f5f5f5;
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  font-size: 12px;
}

.response-count {
  font-size: 12px;
}

.consensus-component__instructions {
  padding: 6px;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin-top: 6px;
  font-size: 11px;
  text-align: center;
  flex-shrink: 0;
}

/* 타이머 섹션 스타일 */
.timer-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.timer-display {
  font-weight: bold;
  font-size: 14px;
  color: #333;
}

.timer-controls {
  display: flex;
  gap: 6px;
}

.timer-button {
  background-color: var(--primary-color, #007bff);
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-button {
  padding: 8px 10px;
}

.timer-button:disabled {
  background-color: var(--gray, #6c757d);
  cursor: not-allowed;
}

.timer-button:not(:disabled):hover {
  background-color: #0056b3;
}
</style>
