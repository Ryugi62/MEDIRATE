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
        <span class="legend-item agree">마이토시스</span>
        <span class="legend-item disagree">논 마이토시스</span>
      </div>

      <div class="consensus-component__actions">
        <button @click="agreeAll" :disabled="!isRunning" class="action-btn agree-btn">
          전체 마이토시스 (Space)
        </button>
        <button @click="disagreeAll" :disabled="!isRunning" class="action-btn disagree-btn">
          전체 논 마이토시스 (Shift+Space)
        </button>
        <button @click="commitChanges" class="save-btn">Save</button>
      </div>
    </div>

    <div class="consensus-component__body">
      <div class="canvas-container">
        <canvas
          ref="canvas"
          @click="handleCanvasClick"
          @contextmenu.prevent="handleRightClick"
          @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave"
          :class="{ 'canvas-disabled': !isRunning }"
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
      <ShortcutHelp
        :operations="helpOperations"
        :shortcuts="helpShortcuts"
        @collapse-change="onHelpCollapseChange"
      />
    </div>

    <div class="consensus-component__footer">
      <strong>{{ fileName }}</strong>
      <span class="response-count">
        응답: {{ respondedCount }} / {{ totalFpCount }}
      </span>
    </div>
  </div>
</template>

<script>
import ZoomLens from "./ZoomLens.vue";
import ShortcutHelp from "./ShortcutHelp.vue";

export default {
  name: "ConsensusComponent",
  components: {
    ZoomLens,
    ShortcutHelp,
  },

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
      // 슬라이드 전환 시 race condition 방지
      currentLoadId: 0,
      isUnmounted: false,
      // Undo/Redo 관련
      undoStack: [],
      redoStack: [],
      maxHistorySize: 50,
      // 확대경 관련
      zoomMouseX: 0,
      zoomMouseY: 0,
      isZoomActive: false,
      canvasHeight: 280,
      // 단축키 도움말
      helpOperations: [
        { action: "좌클릭", description: "마이토시스" },
        { action: "우클릭", description: "논 마이토시스" },
      ],
      helpShortcuts: [
        { key: "Space", description: "전체 마이토시스" },
        { key: "Shift+Space", description: "전체 논 마이토시스" },
        { key: "Ctrl+Z", description: "되돌리기" },
        { key: "Ctrl+Shift+Z", description: "다시실행" },
        { key: "Ctrl+S", description: "저장" },
        { key: "↑/↓", description: "이전/다음" },
      ],
      helpCollapsed: false,
    };
  },

  computed: {
    fileName() {
      return this.questionImage || this.src.split("/").pop();
    },
    // 확대경 크기 (캔버스 높이의 40%, min 200px ~ max 350px)
    zoomSize() {
      const size = Math.floor(this.canvasHeight * 0.4);
      return Math.max(200, Math.min(350, size));
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

    // Undo/Redo 메서드
    saveStateForUndo() {
      // 현재 이미지의 FP 응답만 저장
      const currentImageFpIds = this.currentImageFpSquares.map((fp) => fp.id);
      const currentResponses = {};
      currentImageFpIds.forEach((id) => {
        if (this.localResponses[id]) {
          currentResponses[id] = this.localResponses[id];
        }
      });
      const stateSnapshot = JSON.stringify(currentResponses);

      // 이전 상태와 동일하면 저장하지 않음
      if (this.undoStack.length > 0) {
        const lastState = this.undoStack[this.undoStack.length - 1];
        if (lastState === stateSnapshot) {
          return;
        }
      }

      this.undoStack.push(stateSnapshot);

      // 최대 히스토리 크기 제한
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }

      // 새 작업 시 redoStack 초기화
      this.redoStack = [];
    },

    undo() {
      if (this.undoStack.length === 0) return;

      // 현재 상태를 redoStack에 저장
      const currentImageFpIds = this.currentImageFpSquares.map((fp) => fp.id);
      const currentResponses = {};
      currentImageFpIds.forEach((id) => {
        if (this.localResponses[id]) {
          currentResponses[id] = this.localResponses[id];
        }
      });
      this.redoStack.push(JSON.stringify(currentResponses));

      // 이전 상태 복원
      const previousState = this.undoStack.pop();
      const restoredResponses = JSON.parse(previousState);

      // 현재 이미지의 응답만 교체 (다른 이미지 응답은 유지)
      currentImageFpIds.forEach((id) => {
        if (restoredResponses[id]) {
          this.localResponses[id] = restoredResponses[id];
        } else {
          delete this.localResponses[id];
        }
      });

      this.redrawSquares();
    },

    redo() {
      if (this.redoStack.length === 0) return;

      // 현재 상태를 undoStack에 저장
      const currentImageFpIds = this.currentImageFpSquares.map((fp) => fp.id);
      const currentResponses = {};
      currentImageFpIds.forEach((id) => {
        if (this.localResponses[id]) {
          currentResponses[id] = this.localResponses[id];
        }
      });
      this.undoStack.push(JSON.stringify(currentResponses));

      // 다음 상태 복원
      const nextState = this.redoStack.pop();
      const restoredResponses = JSON.parse(nextState);

      // 현재 이미지의 응답만 교체 (다른 이미지 응답은 유지)
      currentImageFpIds.forEach((id) => {
        if (restoredResponses[id]) {
          this.localResponses[id] = restoredResponses[id];
        } else {
          delete this.localResponses[id];
        }
      });

      this.redrawSquares();
    },

    clearHistory() {
      this.undoStack = [];
      this.redoStack = [];
    },

    async loadBackgroundImage() {
      const loadId = ++this.currentLoadId;

      if (!this.src) {
        return;
      }
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

      // 부모 컨테이너(.consensus-component__body)에서 크기 측정
      const body = this.$el.querySelector(".consensus-component__body");
      if (!body) return;
      const bodyRect = body.getBoundingClientRect();

      // 가용 크기 계산 (ZoomLens 크기 + ShortcutHelp 크기 + gap 제외)
      const zoomLensWidth = this.zoomSize || 200;
      // 고정 너비 사용 (렌더링 타이밍 문제 방지)
      const helpWidth = this.helpCollapsed ? 28 : 180;
      const gap = 10;
      const totalGap = gap * 2;
      const availableWidth = bodyRect.width - zoomLensWidth - helpWidth - totalGap;
      const availableHeight = bodyRect.height;

      // 이미지 비율에 맞게 캔버스 크기 계산
      const scaleX = availableWidth / this.originalWidth;
      const scaleY = availableHeight / this.originalHeight;
      const scale = Math.min(scaleX, scaleY);
      canvas.width = Math.floor(this.originalWidth * scale);
      canvas.height = Math.floor(this.originalHeight * scale);

      // 결과 저장
      this.localCanvasInfo.width = canvas.width;
      this.localCanvasInfo.height = canvas.height;
      this.canvasHeight = canvas.height;

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

      // 좌표 범위 체크 (이미지 영역 내로 제한)
      const clampedX = Math.max(0, Math.min(originalX, this.originalWidth));
      const clampedY = Math.max(0, Math.min(originalY, this.originalHeight));

      return {
        canvasX: clampedX * scale + x,
        canvasY: clampedY * scale + y,
        isOutOfBounds: originalX !== clampedX || originalY !== clampedY,
      };
    },

    findClosestFpSquare(canvasX, canvasY) {
      const canvas = this.$refs.canvas;
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const CLICK_THRESHOLD = 50 * scale; // 클릭 인식 범위 - scale 적용

      let closest = null;
      let minDistance = Infinity;

      this.currentImageFpSquares.forEach((fp) => {
        const { canvasX: fpCanvasX, canvasY: fpCanvasY } =
          this.originalToCanvasCoordinates(fp.x + 12.5, fp.y + 12.5);
        const distance = Math.hypot(fpCanvasX - canvasX, fpCanvasY - canvasY);

        if (distance <= CLICK_THRESHOLD && distance < minDistance) {
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
        // Undo를 위해 현재 상태 저장
        this.saveStateForUndo();

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
        // Undo를 위해 현재 상태 저장
        this.saveStateForUndo();

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

      // Undo를 위해 현재 상태 저장
      this.saveStateForUndo();

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

      // Undo를 위해 현재 상태 저장
      this.saveStateForUndo();

      this.currentImageFpSquares.forEach((fp) => {
        this.localResponses[fp.id] = "disagree";
      });
      this.redrawSquares();
    },

    redrawSquares(event = null) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      this.drawBackgroundImage();
      const ctx = canvas.getContext("2d");

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      this.currentImageFpSquares.forEach((fp) => {
        const response = this.localResponses[fp.id];
        const { canvasX, canvasY, isOutOfBounds } = this.originalToCanvasCoordinates(
          fp.x + 12.5,
          fp.y + 12.5
        );

        // 이미지 영역 밖의 좌표는 표시하지 않음
        if (isOutOfBounds) {
          return;
        }

        // 색상 결정
        let color;
        let fillAlpha = 0;
        if (response === "agree") {
          color = "#00FF00"; // 녹색 - 마이토시스
          fillAlpha = 0.2;
        } else if (response === "disagree") {
          color = "#FF0000"; // 빨강 - 논 마이토시스
          fillAlpha = 0.2;
        } else {
          color = "#FFA500"; // 주황 - 미응답
          fillAlpha = 0;
        }

        // 배경 채우기 (응답된 경우)
        if (fillAlpha > 0) {
          ctx.fillStyle = color;
          ctx.globalAlpha = fillAlpha;
          ctx.fillRect(canvasX - boxHalf, canvasY - boxHalf, boxSize, boxSize);
          ctx.globalAlpha = 1;
        }

        // 테두리 그리기
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(canvasX - boxHalf, canvasY - boxHalf, boxSize, boxSize);

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

      // 마우스 호버 시 하이라이트 (평가 시작 후에만)
      if (event && this.isRunning) {
        this.activeSquareCursor(event);
      }
    },

    activeSquareCursor(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      // 가장 가까운 FP 찾기
      const closestFp = this.findClosestFpSquare(x, y);

      if (closestFp) {
        const { canvasX, canvasY } = this.originalToCanvasCoordinates(
          closestFp.x + 12.5,
          closestFp.y + 12.5
        );

        ctx.lineWidth = 1 * scale;
        ctx.strokeStyle = "#00FFFF"; // cyan 하이라이트
        ctx.strokeRect(canvasX - boxHalf, canvasY - boxHalf, boxSize, boxSize);
      }
    },

    handleCanvasMouseMove(event) {
      if (!this.isRunning) return;

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

      this.redrawSquares(event);
    },

    handleCanvasMouseLeave() {
      this.isZoomActive = false;
      this.redrawSquares();
    },

    onHelpCollapseChange(collapsed) {
      this.helpCollapsed = collapsed;
      this.$nextTick(() => {
        this.resizeCanvas();
      });
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
      } else if (event.ctrlKey && !event.shiftKey && event.key === "z") {
        // Ctrl+Z: Undo
        event.preventDefault();
        this.undo();
      } else if (event.ctrlKey && event.shiftKey && event.key === "Z") {
        // Ctrl+Shift+Z: Redo (Shift 누르면 대문자 "Z"가 됨)
        event.preventDefault();
        this.redo();
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
    this.isUnmounted = true;
    this.currentLoadId++;  // 진행 중인 로드 무효화
    window.removeEventListener("resize", this.resizeCanvas);
    window.removeEventListener("keydown", this.handleKeydown);
    this.clearTimerInterval();
  },

  watch: {
    src: {
      immediate: true,
      handler: async function (newVal, oldVal) {
        if (newVal !== oldVal) {
          // 이미지 변경 시 Undo/Redo 히스토리 초기화
          this.clearHistory();
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
  transition: border 0.3s;
  background-color: #fff;
  cursor: crosshair;
}

canvas.canvas-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.zoom-lens {
  flex-shrink: 0;
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
