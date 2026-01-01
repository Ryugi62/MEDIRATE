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
        <div v-for="icon in iconList" :key="icon.name" class="icon-item"
          :class="{
            active: icon.name === 'fa-robot' ? showAiBoxes : icon.active,
            'ai-active': icon.name === 'fa-robot' && showAiBoxes,
            'ai-inactive': icon.name === 'fa-robot' && !showAiBoxes,
            disabled: !isRunning,
          }"
          @click="handleIconClick(icon)" :aria-label="icon.explanation">
          <i :class="['fas', icon.name]"></i>
          <span class="icon-explanation">{{ icon.explanation }}</span>
        </div>
      </div>

      <div class="bbox-component__actions">
        <button @click="applyMitosis" :disabled="!is_ai_use">AI Confirm</button>
        <button @click="commitChanges('bbox', goNext)">Save</button>
      </div>
    </div>

    <div class="bbox-component__body">
      <canvas ref="canvas" @click="handleCanvasClick" @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave" @mouseenter="redrawSquares" @contextmenu.prevent
        @contextmenu="redrawSquares" :class="{ 'canvas-disabled': !isRunning }"></canvas>
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
    is_timer: { type: Boolean, required: false, default: true },
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
      showAiBoxes: false,
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
      showAiAlert: false,
      temporarySquares: [],
      goNext: true,
      timer: 0,
      isRunning: false,
      timerInterval: null,
      // 슬라이드 전환 시 race condition 방지
      currentLoadId: 0,
      isUnmounted: false,
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
      if (event.ctrlKey && event.key === "c") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        this.applyMitosis();
      } else if (event.ctrlKey && event.key === "s") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        this.commitChanges("bbox", this.goNext);
      } else if (event.ctrlKey && event.key === "a") {
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

    async initializeComponent() {
      this.fetchLocalInfo();
      await this.loadBackgroundImage();
    },

    fetchLocalInfo() {
      this.localBeforeCanvas = this.beforeCanvas;
      this.localSquares = [...this.squares];
      this.temporarySquares = [...this.squares];

      // Only set the timer if it's not already running
      if (this.timer === 0) {
        this.timer = this.evaluation_time || 0;
      }
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
        this.showAiBoxes = !this.showAiBoxes; // AI 박스 표시/숨김 토글
        if (this.showAiBoxes) {
          await this.showTempAIBox(); // AI 박스 로드
        }
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
      // 0으로 나누기 방지
      if (!this.originalWidth || !this.originalHeight) {
        return { x: 0, y: 0, scale: 1 };
      }

      const scale = Math.min(
        canvasWidth / this.originalWidth,
        canvasHeight / this.originalHeight
      );
      // 확대경(우측 상단 300x300)과 겹치지 않도록 이미지를 왼쪽으로 100px 이동
      const imageOffset = 100;
      const x = (canvasWidth - this.originalWidth * scale) / 2 - imageOffset;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    async resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

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

      // 이미지 영역 밖 클릭 방지 (검정색 배경 영역)
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imgWidth = this.originalWidth * scale;
      const imgHeight = this.originalHeight * scale;

      if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
        return; // 이미지 영역 밖이면 무시
      }

      this.eraserActive ? this.eraseSquare(x, y) : this.drawSquare(x, y);
    },

    drawSquare(x, y) {
      const canvas = this.$refs.canvas;
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const MIN_DISTANCE = 20 * scale; // 최소 거리 - scale 적용

      // 기존 박스와 너무 가까운지 체크
      const isTooClose = this.temporarySquares.some((square) => {
        if (square.questionIndex !== this.questionIndex) return false;
        if (square.isTemporary && !square.isAI) return false; // 임시 박스는 무시
        const distance = Math.hypot(square.x - x, square.y - y);
        return distance < MIN_DISTANCE;
      });

      if (isTooClose) {
        return; // 너무 가까우면 추가 금지
      }

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
      const canvas = this.$refs.canvas;
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const CLICK_THRESHOLD = 50 * scale; // 클릭 인식 범위 - scale 적용

      return this.temporarySquares.reduce(
        (closest, square) => {
          const distance = Math.hypot(square.x - x, square.y - y);
          if (distance <= CLICK_THRESHOLD && square.questionIndex === this.questionIndex) {
            return distance < closest.distance ? { square, distance } : closest;
          }
          return closest;
        },
        { square: null, distance: Infinity }
      ).square;
    },

    redrawSquares(event = null) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      this.drawBackgroundImage();
      const ctx = canvas.getContext("2d");

      // 이미지 영역 계산 (이미지 밖의 박스는 표시하지 않음)
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imageLeft = imgX;
      const imageTop = imgY;
      const imageRight = imgX + this.originalWidth * scale;
      const imageBottom = imgY + this.originalHeight * scale;

      this.temporarySquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        if (square.isTemporary && !square.isAI) return; // 임시 박스는 그리지 않음

        // 새로 불러온 AI 박스(isTemporaryAI)만 AI 모드에서 표시
        // 이미 저장된 AI 박스(isAI && !isTemporaryAI)는 항상 표시
        if (square.isTemporaryAI && !this.showAiBoxes) return;

        // 이미지 영역 밖의 박스는 표시하지 않음
        if (square.x < imageLeft || square.x > imageRight ||
            square.y < imageTop || square.y > imageBottom) {
          return;
        }

        // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
        const boxSize = 20 * scale;
        const boxHalf = boxSize / 2;

        // 박스 타입별 스타일 차별화
        if (square.isTemporaryAI) {
          // AI 탐지 박스 (아직 Apply 안됨) - 노란색
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2 * scale;
          ctx.globalAlpha = 0.8;
          ctx.strokeRect(square.x - boxHalf, square.y - boxHalf, boxSize, boxSize);
        } else if (square.isAI) {
          // AI Apply 후 확정된 박스 - 형광 파란색
          ctx.strokeStyle = "#00BFFF";
          ctx.lineWidth = 2 * scale;
          ctx.globalAlpha = 1;
          ctx.strokeRect(square.x - boxHalf, square.y - boxHalf, boxSize, boxSize);
        } else {
          // 전문의 지정 박스 - 빨간색
          ctx.strokeStyle = "#FF0000";
          ctx.lineWidth = 2 * scale;
          ctx.globalAlpha = 1;
          ctx.strokeRect(square.x - boxHalf, square.y - boxHalf, boxSize, boxSize);
        }
        ctx.globalAlpha = 1;
      });

      if (event && this.isRunning) {
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
        // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
        const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
        const boxSize = 20 * scale;
        const boxHalf = boxSize / 2;

        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = "blue";
        ctx.strokeRect(closestSquare.x - boxHalf, closestSquare.y - boxHalf, boxSize, boxSize);
      }
    },

    handleCanvasMouseLeave() {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.redrawSquares();
    },
    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(canvas.width, canvas.height);

      // 확대경 크기를 고정값으로 설정 (정사각형 유지)
      const baseZoomSize = 300;
      const zoomLevel = 2.0;
      const zoomSize = 280; // 고정 크기 (정사각형)
      const zoomWidth = zoomSize;
      const zoomHeight = zoomSize;

      // 캡처 영역은 고정 (스케일과 무관하게 항상 동일한 영역 표시)
      const sourceWidth = baseZoomSize / zoomLevel;
      const sourceHeight = baseZoomSize / zoomLevel;

      const mouseXOnImage = (x - imgX) / scale;
      const mouseYOnImage = (y - imgY) / scale;

      // 이미지 영역 밖(검은 영역)에서는 줌을 표시하지 않음
      if (
        !this.backgroundImage ||
        mouseXOnImage < 0 ||
        mouseYOnImage < 0 ||
        mouseXOnImage > this.originalWidth ||
        mouseYOnImage > this.originalHeight
      ) {
        return;
      }

      const sourceX = mouseXOnImage - sourceWidth / 2;
      const sourceY = mouseYOnImage - sourceHeight / 2;

      // 확대경 위치: 이미지 우측 끝에서 고정 간격으로
      const imageRightEdge = imgX + this.originalWidth * scale;
      const zoomGap = 20;
      const zoomX = imageRightEdge + zoomGap;

      this.redrawSquares();

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
      if (!canvas || this.isUnmounted) return;

      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);

      // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const boxSize = 20 * scale;
      const boxHalf = boxSize / 2;

      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = "orange";
      ctx.strokeRect(x - boxHalf, y - boxHalf, boxSize, boxSize);
    },

    applyMitosis() {
      if (!this.isRunning || !this.is_ai_use) return;

      const filter_temporarySquares = this.temporarySquares.filter((s) => {
        // 현재 질문의 박스만 필터링하고, 다른 질문의 박스는 그대로 유지
        if (s.questionIndex !== this.questionIndex) {
          return true; // 다른 질문의 박스는 유지
        }
        return true; // 모든 AI 박스 포함
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

    // 초기화 (mounted에서 실행하여 $refs.canvas가 있는 상태에서 실행)
    this.initializeComponent();

    window.addEventListener("resize", this.resizeCanvas);
    window.addEventListener("keydown", this.handleHotkeys);

    // 타이머 초기화 (props에서 받은 evaluation_time)
    if (this.evaluation_time) {
      this.timer = this.evaluation_time;
    }

    // D1: Timer가 비활성화된 경우 평가는 항상 가능하도록 설정
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
      handler: async function (newVal, oldVal) {
        // src가 변경될 때만 실행 (초기 로딩은 mounted에서 처리)
        if (newVal && newVal !== oldVal) {
          await this.loadBackgroundImage();
          this.fetchLocalInfo();
          this.resizeCanvas();
        }
      },
    },

    isSliderActive() {
      this.resizeCanvas();
    },
  },
};
</script>

<style scoped>
.bbox-component {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 8px;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.bbox-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.bbox-component__header__left {
  gap: 8px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  flex-wrap: wrap;
}

.bbox-component__header label {
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

/* AI 아이콘 On/Off 상태 표시 */
.icon-item.ai-active {
  color: var(--blue);
}

.icon-item.ai-inactive {
  color: #888;
}

.icon-item.ai-active:hover {
  color: var(--blue-hover);
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
  min-height: 0;
  overflow: hidden;
}

canvas {
  border: 1px solid #ccc;
  max-height: 100%;
  max-width: 100%;
  background-color: white;
  cursor: crosshair;
}

canvas.canvas-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.bbox-component__footer {
  padding: 4px;
  color: #333;
  text-align: center;
  background-color: #f5f5f5;
  margin-top: 4px;
  flex-shrink: 0;
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
