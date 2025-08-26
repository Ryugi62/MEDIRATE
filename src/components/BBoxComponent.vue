<!-- BBoxComponent.vue -->

<template>
  <div class="bbox-component">
    <div class="bbox-component__header">
      <span class="bbox-component__header__left">
        <label>
          <input type="checkbox" v-model="showAiAlert" />
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
            <button @click="refreshTimer" class="timer-button refresh-button" :disabled="isRunning" title="새로고침">
              가장 마지막 평가 시간으로 복귀
            </button>
          </div>
        </div>
      </span>

      <div class="icon-list">
        <i v-for="icon in iconList" :key="icon.name" :class="[
          'fas',
          icon.name,
          { active: icon.active },
          { disabled: !isRunning },
        ]" @click="handleIconClick(icon)" :aria-label="icon.explanation">
          <span class="icon-explanation">({{ icon.explanation }})</span>
        </i>
      </div>

      <div class="bbox-component__actions">
        <!-- is_ai_use가 true인 경우에만 점수 조절 슬라이드 바 표시 -->
        <div class="is_score_field" v-if="is_ai_use && is_score">
          <label for="is_score">{{ score_value }}%</label>
          <input type="range" name="is_score" id="is_score" min="0" max="100" v-model="score_value" />
        </div>
        <button @click="applyMitosis" :disabled="!is_ai_use">AI Apply</button>
        <button @click="commitChanges('bbox', goNext)">Save</button>
      </div>
    </div>

    <div class="bbox-component__body">
      <canvas ref="canvas" @click="handleCanvasClick" @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave" @mouseenter="redrawSquares" @contextmenu.prevent
        @contextmenu="redrawSquares"></canvas>
    </div>
    <div class="bbox-component__footer">
      <strong>{{ fileName }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: "BBoxComponent",

  props: {
    beforeCanvas: { type: Object, required: true, default: () => ({}) },
    squares: {
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
    evaluation_time: { type: Number, required: false, default: 0 },
  },

  emits: ["update:squares", "commitAssignmentChanges"],

  data() {
    return {
      iconList: [
        { name: "fa-square", active: true, explanation: "추가" },
        { name: "fa-eraser", active: false, explanation: "선택삭제" },
        { name: "fa-circle-minus", active: false, explanation: "전체삭제" },
        { name: "fa-robot", active: false, explanation: "AI" },
      ],
      localBeforeCanvas: {},
      localSquares: [],
      aiSquares: [],
      aiFirst: true,
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
      showAiAlert: false,
      temporarySquares: [],
      goNext: true,
      score_value: 50,
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

    isSliderActive() {
      return this.$store.getters.isSlideBarOpen;
    },
    fileName() {
      return this.src.split("/").pop();
    },
    formattedTime() {
      const totalSeconds = Math.floor(this.timer / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
        2,
        "0"
      );
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    },
  },

  methods: {
    handleIconClick(icon) {
      if (!this.isRunning) {
        if (this.showAiAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }
      // is_ai_use가 true인 경우에만 AI 아이콘 활성화 가능
      if (!this.is_ai_use && icon.name === "fa-robot") {
        alert("AI 기능을 사용할 수 없습니다.");
        return;
      }
      this.activateIcon(icon);
    },

    handleHotkeys(event) {
      if (event.ctrlKey && event.key === "a") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        this.applyMitosis();
      } else if (event.ctrlKey && event.key === "s") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        this.commitChanges("bbox", this.goNext);
      } else if (event.ctrlKey && event.key === "i") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // ai icon 활성화
        if (!this.is_ai_use) {
          alert("AI 기능을 사용할 수 없습니다.");
          return;
        }
        const aiIcon = this.iconList.find((icon) => icon.name === "fa-robot");
        this.handleIconClick(aiIcon);
      } else if (event.ctrlKey && event.key === "e") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // eraser icon 활성화
        const eraserIcon = this.iconList.find(
          (icon) => icon.name === "fa-eraser"
        );
        this.handleIconClick(eraserIcon);
      } else if (event.ctrlKey && event.key === "q") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // square icon 활성화
        const squareIcon = this.iconList.find(
          (icon) => icon.name === "fa-square"
        );
        this.handleIconClick(squareIcon);
      } else if (event.ctrlKey && event.key === "d") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // circle-minus icon 활성화
        const circleMinusIcon = this.iconList.find(
          (icon) => icon.name === "fa-circle-minus"
        );
        this.handleIconClick(circleMinusIcon);
      }
    },

    async fetchLocalInfo() {
      this.localBeforeCanvas = this.beforeCanvas;
      this.localSquares = [...this.squares];
      this.temporarySquares = [...this.squares];

      // Only set the timer if it's not already running
      if (this.timer === 0) {
        this.timer = this.evaluation_time || 0;
      }

      // AI 버튼을 눌러야만 AI 박스를 표시하도록 변경
      // 자동으로 AI 박스를 표시하지 않음
    },

    async activateIcon(selectedIcon) {
      if (!this.is_ai_use && selectedIcon.name === "fa-robot") {
        alert("AI 기능을 사용할 수 없습니다.");
        return;
      }

      if (selectedIcon.name === "fa-circle-minus") {
        // 알람이 활성화 되었다면
        if (
          this.showAiAlert &&
          !confirm("정말로 모든 사각형을 삭제하시겠습니까?")
        )
          return;

        // 임시로 전체 삭제
        this.temporarySquares = this.temporarySquares.filter(
          (square) => square.questionIndex !== this.questionIndex
        );

        this.redrawSquares();

        return;
      } else if (selectedIcon.name === "fa-robot") {
        await this.showTempAIBox(); // 분리된 함수 호출
      }

      this.resizeCanvas();
      this.iconList = this.iconList.map((icon) => ({
        ...icon,
        active: icon === selectedIcon,
      }));
    },

    async showTempAIBox() {
      if (!this.is_ai_use) return; // is_ai_use가 false인 경우 실행하지 않음

      try {
        const response = await this.$axios.get("/api/assignments/ai/", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
          params: {
            src: this.src.split("/").pop(),
            assignmentType: this.assignmentType,
            questionIndex: this.questionIndex,
          },
        });

        if (response.data.length === 0 && this.showAiAlert) {
          alert("AI 데이터가 없습니다.");
        }

        let newAiSquares = response.data.map((e) => ({
          x: e.x + 12.5,
          y: e.y + 12.5,
          questionIndex: this.questionIndex,
          isTemporaryAI: true,
          originalX: e.x + 12.5,
          originalY: e.y + 12.5,
          isAI: true,
          score: e.score,
          isTemporary: true,
        }));

        const originalLocalSquares = this.temporarySquares.map((square) => ({
          ...square,
          originalX: this.convertToOriginalCoordinate(square.x, "x"),
          originalY: this.convertToOriginalCoordinate(square.y, "y"),
        }));

        newAiSquares = newAiSquares.filter(
          (aiSquare) =>
            !originalLocalSquares.some(
              (square) =>
                Math.abs(square.originalX - aiSquare.originalX) <= 5 &&
                Math.abs(square.originalY - aiSquare.originalY) <= 5 &&
                square.questionIndex === this.questionIndex &&
                square.isAI
            )
        );

        for (let i = 0; i < newAiSquares.length; i++) {
          for (let j = i + 1; j < newAiSquares.length; j++) {
            if (
              Math.abs(newAiSquares[i].originalX - newAiSquares[j].originalX) <=
              5 &&
              Math.abs(newAiSquares[i].originalY - newAiSquares[j].originalY) <=
              5
            ) {
              newAiSquares.splice(j, 1);
              j--;
            }
          }
        }

        this.setAiSquarePosition(newAiSquares);
        this.temporarySquares = [...this.temporarySquares, ...newAiSquares];
        this.redrawSquares();
      } catch (error) {
        if (this.showAiAlert) {
          alert("AI 데이터 파일이 존재하는지 확인해주세요.");
        }
        console.error(error);
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
      const x = (canvasWidth - this.originalWidth * scale) / 2;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      if (this.localBeforeCanvas.width && this.localBeforeCanvas.height) {
        canvas.width = this.localBeforeCanvas.width;
        canvas.height = this.localBeforeCanvas.height;
      }

      const beforePosition = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      this.beforeResizePosition = beforePosition;

      canvas.width = 0;
      canvas.height = 0;

      const bboxBody = this.$el
        .querySelector(".bbox-component__body")
        .getBoundingClientRect();
      canvas.width = bboxBody.width;
      canvas.height = bboxBody.height;

      this.localBeforeCanvas.width = canvas.width;
      this.localBeforeCanvas.height = canvas.height;

      this.drawBackgroundImage();
      await this.setSquaresPosition(beforePosition);
      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      if (!this.temporarySquares.length) return;

      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale;

      this.temporarySquares.forEach((square) => {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });
    },

    convertToOriginalCoordinate(coord, axis) {
      const canvas = this.$refs.canvas;
      const { x, y, scale } = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );
      if (axis === "x") {
        return (coord - x) / scale;
      } else if (axis === "y") {
        return (coord - y) / scale;
      }
      return coord;
    },

    setAiSquarePosition(aiSquares) {
      if (!aiSquares || !aiSquares.length) return;

      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);

      aiSquares.forEach((square) => {
        square.x = square.originalX * currentPosition.scale + currentPosition.x;
        square.y = square.originalY * currentPosition.scale + currentPosition.y;
      });

      this.aiFirst = false;
    },

    handleCanvasClick(event) {
      if (!this.isRunning) {
        if (this.showAiAlert) {
          alert("평가를 시작해주세요.");
        }
        return;
      }
      const { x, y } = this.getCanvasCoordinates(event);
      this.eraserActive ? this.eraseSquare(x, y) : this.drawSquare(x, y);
    },

    drawSquare(x, y) {
      // this.temporarySquares에 같은 x, y 좌표가 있는지 확인 후 있으면 return
      const checkSameCoordinate = this.temporarySquares.some(
        (square) => square.x === x && square.y === y
      );
      if (checkSameCoordinate) return;

      this.temporarySquares.push({
        x,
        y,
        questionIndex: this.questionIndex,
        isTemporary: false,
      });
      this.redrawSquares();
    },

    eraseSquare(mouseX, mouseY) {
      const closestSquare = this.getClosestSquare(mouseX, mouseY);

      if (closestSquare) {
        const index = this.temporarySquares.indexOf(closestSquare);
        if (index !== -1) {
          this.temporarySquares.splice(index, 1);
        }
        this.redrawSquares();
      }
    },

    getClosestSquare(x, y) {
      return this.temporarySquares.reduce(
        (closest, square) => {
          const distance = Math.hypot(square.x - x, square.y - y);
          if (distance <= 50 && square.questionIndex === this.questionIndex) {
            return distance < closest.distance ? { square, distance } : closest;
          }
          return closest;
        },
        { square: null, distance: Infinity }
      ).square;
    },

    redrawSquares(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");

      this.temporarySquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        if (square.isTemporary && !square.isAI) return; // 임시 박스는 그리지 않음

        if (
          square.isAI &&
          this.is_score &&
          this.score_value / 100 > square.score
        )
          return;
        ctx.lineWidth = 2;
        ctx.strokeStyle = square.isAI ? "#FFFF00" : "#FF0000";
        ctx.globalAlpha = square.isTemporaryAI ? 0.7 : 1;
        ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
        ctx.globalAlpha = 1;
      });

      if (event) {
        this.activeEnlarge(event);
        this.activeSquareCursor(event);
      }
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

    handleCanvasMouseMove(event) {
      if (!this.isRunning) {
        return;
      }
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const closestSquare = this.getClosestSquare(x, y);

      this.redrawSquares(event);

      if (closestSquare && this.eraserActive) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "blue";
        ctx.strokeRect(closestSquare.x - 12.5, closestSquare.y - 12.5, 25, 25);
      }
    },

    handleCanvasMouseLeave() {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.redrawSquares();
    },
    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 200;
      const zoomHeight = 200;
      const zoomLevel = 2.5;

      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(canvas.width, canvas.height);
      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      const sourceX = mouseXOnImage - zoomWidth / zoomLevel / 2;
      const sourceY = mouseYOnImage - zoomHeight / zoomLevel / 2;
      const sourceWidth = zoomWidth / zoomLevel;
      const sourceHeight = zoomHeight / zoomLevel;

      this.redrawSquares();

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

    activeSquareCursor(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const squareSize = 25;

      ctx.lineWidth = 2;
      ctx.strokeStyle = "orange";
      ctx.strokeRect(
        x - squareSize / 2,
        y - squareSize / 2,
        squareSize,
        squareSize
      );
    },

    applyMitosis() {
      if (!this.isRunning || !this.is_ai_use) return;

      const filter_temporarySquares = this.temporarySquares.filter((s) => {
        // 현재 질문의 박스만 필터링하고, 다른 질문의 박스는 그대로 유지
        if (s.questionIndex !== this.questionIndex) {
          return true; // 다른 질문의 박스는 유지
        }
        return !s.isAI || s.score >= this.score_value / 100;
      });

      // 현재 질문의 박스만 업데이트
      this.temporarySquares = filter_temporarySquares.map((square) => {
        if (
          square.questionIndex === this.questionIndex &&
          square.isTemporaryAI
        ) {
          return {
            ...square,
            isTemporaryAI: false,
            isTemporary: false,
          };
        }
        return square;
      });

      this.redrawSquares();
    },

    toggleTimer() {
      if (!this.isRunning) {
        // Start the timer
        this.startTimer();
      } else {
        // Pause the timer
        this.pauseTimer();
      }
    },

    async refreshTimer() {
      try {
        this.timer = this.evaluation_time;
        this.redrawSquares(); // Update display
      } catch (error) {
        console.error("타이머 초기화 중 오류 발생:", error);
        alert("타이머 초기화에 실패했습니다.");
      }
    },

    commitChanges(type, goNext) {
      this.localSquares = [...this.temporarySquares];
      this.$emit("update:squares", this.localSquares);

      // 타이머 값을 포함하여 데이터 제출
      this.$emit("commitAssignmentChanges", type, goNext, this.timer);
    },

    // 타이머 관련 메서드
    startTimer() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.timerInterval = setInterval(() => {
        this.timer += 1000; // 1초(1000ms)마다 증가
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
  },

  mounted() {
    if (!this.is_ai_use)
      this.iconList = this.iconList.filter((e) => e.name !== "fa-robot");
    this.fetchLocalInfo();
    this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
    window.addEventListener("keydown", this.handleHotkeys);

    // 타이머 초기화 (props에서 받은 evaluation_time)
    if (this.evaluation_time) {
      this.timer = this.evaluation_time;
    }
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
    window.removeEventListener("keydown", this.handleHotkeys);
    this.clearTimerInterval();
  },

  watch: {
    src: {
      immediate: true, // 초기 렌더링 시에도 호출하도록 설정
      handler: async function (newVal, oldVal) {
        if (newVal !== oldVal) {
          await this.loadBackgroundImage();
          await this.fetchLocalInfo();
          // AI 버튼을 눌러야만 AI 박스를 표시하도록 변경
          // 이미지 변경 시 자동으로 AI 박스를 표시하지 않음
          this.resizeCanvas();
        }
      },
    },

    isSliderActive() {
      this.resizeCanvas();
    },

    score_value() {
      this.redrawSquares();
    },
  },
};
</script>

<style scoped>
.bbox-component {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 10px;
}

.bbox-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.bbox-component__header__left {
  gap: 8px;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.bbox-component__header label {
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
  padding: 10px;
  transition: color 0.3s;
  position: relative;
}

.icon-list i.disabled {
  pointer-events: none;
  opacity: 0.5;
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
  /* Position above the icon */
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

.bbox-component__actions {
  display: flex;
  gap: 10px;
}

.is_score_field {
  gap: 4px;
  display: flex;
  align-items: center;
}

.bbox-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  border: 1px solid #ccc;
  min-height: 550px;
  transition: border 0.3s;
  background-color: #000;
}

canvas:hover {
  border: 1px solid var(--primary-color, #007bff);
}

.bbox-component__footer {
  padding: 5px;
  color: #fff;
  text-align: center;
  background-color: #000;
  margin-top: 10px;
}

/* 타이머 섹션 스타일 추가 */
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

.refresh-button {
  padding: 8px 10px;
}

.timer-button:disabled {
  background-color: var(--gray, #6c757d);
  cursor: not-allowed;
}

.timer-button:not(:disabled):hover {
  background-color: #0056b3;
  /* var(--primary-color)보다 약간 어두운 색상 */
}

/* 기타 기존 스타일 유지 */
.icon-list i .icon-explanation {
  pointer-events: none;
}
</style>
