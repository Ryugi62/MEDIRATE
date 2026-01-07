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
            disabled: !isRunning || isIconDisabled(icon.name),
          }"
          @click="handleIconClick(icon)" :aria-label="icon.explanation">
          <i :class="['fas', icon.name]"></i>
          <span class="icon-explanation">{{ icon.explanation }}</span>
        </div>
      </div>

      <div class="bbox-component__actions">
        <button
          v-if="is_ai_use"
          :style="{ visibility: showAiBoxes ? 'visible' : 'hidden' }"
          @click="applyMitosis"
        >AI Confirm</button>
        <button @click="commitChanges('bbox', goNext)">Save</button>
      </div>
    </div>

    <div class="bbox-component__body">
      <div class="canvas-container">
        <canvas ref="canvas" @click="handleCanvasClick" @mousemove="handleCanvasMouseMove"
          @mouseleave="handleCanvasMouseLeave" @mouseenter="redrawSquares"
          @contextmenu.prevent="handleRightClick" :class="{ 'canvas-disabled': !isRunning }"></canvas>
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
    <div class="bbox-component__footer">
      <strong>{{ fileName }}</strong>
    </div>
  </div>
</template>

<script>
import ZoomLens from "./ZoomLens.vue";
import ShortcutHelp from "./ShortcutHelp.vue";

export default {
  name: "BBoxComponent",
  components: {
    ZoomLens,
    ShortcutHelp,
  },

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
        { name: "fa-rotate-left", active: false, explanation: "되돌리기" },
        { name: "fa-rotate-right", active: false, explanation: "다시실행" },
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
      // Undo/Redo 관련
      undoStack: [],
      redoStack: [],
      maxHistorySize: 50,
      goNext: true,
      timer: 0,
      isRunning: false,
      timerInterval: null,
      // 슬라이드 전환 시 race condition 방지
      currentLoadId: 0,
      isUnmounted: false,
      // 최초 로드 여부 (저장된 좌표 변환용)
      isFirstLoad: true,
      // 확대경 관련
      zoomMouseX: 0,
      zoomMouseY: 0,
      isZoomActive: false,
      canvasHeight: 280,
      // AI 로딩 상태
      isLoadingAi: false,
      // 단축키 도움말
      helpOperations: [
        { action: "좌클릭", description: "박스 추가" },
        { action: "우클릭", description: "박스 삭제" },
      ],
      baseHelpShortcuts: [
        { key: "Ctrl+A", description: "AI 탐지" },
        { key: "Ctrl+Q", description: "박스 추가" },
        { key: "Ctrl+E", description: "선택 삭제" },
        { key: "Ctrl+Z", description: "되돌리기" },
        { key: "Ctrl+Shift+Z", description: "다시실행" },
        { key: "Ctrl+D", description: "전체 삭제" },
        { key: "Ctrl+S", description: "저장" },
        { key: "↑/↓", description: "이전/다음" },
      ],
      helpCollapsed: false,
    };
  },

  computed: {
    helpShortcuts() {
      if (this.is_ai_use && this.showAiBoxes) {
        return [
          { key: "Ctrl+A", description: "AI 탐지" },
          { key: "Ctrl+C", description: "AI Confirm" },
          ...this.baseHelpShortcuts.slice(1),
        ];
      }
      return this.baseHelpShortcuts;
    },

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
    // 확대경 크기 (캔버스 높이의 40%, min 200px ~ max 350px)
    zoomSize() {
      const size = Math.floor(this.canvasHeight * 0.4);
      return Math.max(200, Math.min(350, size));
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
      // 비활성화된 아이콘 클릭 무시
      if (this.isIconDisabled(icon.name)) {
        return;
      }
      // is_ai_use가 true인 경우에만 AI 아이콘 활성화 가능
      if (!this.is_ai_use && icon.name === "fa-robot") {
        alert("AI 기능을 사용할 수 없습니다.");
        return;
      }
      this.activateIcon(icon);
    },

    isIconDisabled(iconName) {
      if (iconName === "fa-rotate-left") {
        return this.undoStack.length === 0;
      }
      if (iconName === "fa-rotate-right") {
        return this.redoStack.length === 0;
      }
      return false;
    },

    // Undo/Redo 메서드
    saveStateForUndo() {
      // 현재 questionIndex에 해당하는 박스만 저장
      const currentSquares = this.temporarySquares.filter(
        (square) => square.questionIndex === this.questionIndex
      );
      const stateSnapshot = JSON.stringify(currentSquares);

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
      const currentSquares = this.temporarySquares.filter(
        (square) => square.questionIndex === this.questionIndex
      );
      this.redoStack.push(JSON.stringify(currentSquares));

      // 이전 상태 복원
      const previousState = this.undoStack.pop();
      const restoredSquares = JSON.parse(previousState);

      // 다른 questionIndex의 박스는 유지하고, 현재 questionIndex 박스만 교체
      this.temporarySquares = this.temporarySquares.filter(
        (square) => square.questionIndex !== this.questionIndex
      );
      this.temporarySquares.push(...restoredSquares);

      this.redrawSquares();
    },

    redo() {
      if (this.redoStack.length === 0) return;

      // 현재 상태를 undoStack에 저장
      const currentSquares = this.temporarySquares.filter(
        (square) => square.questionIndex === this.questionIndex
      );
      this.undoStack.push(JSON.stringify(currentSquares));

      // 다음 상태 복원
      const nextState = this.redoStack.pop();
      const restoredSquares = JSON.parse(nextState);

      // 다른 questionIndex의 박스는 유지하고, 현재 questionIndex 박스만 교체
      this.temporarySquares = this.temporarySquares.filter(
        (square) => square.questionIndex !== this.questionIndex
      );
      this.temporarySquares.push(...restoredSquares);

      this.redrawSquares();
    },

    clearHistory() {
      this.undoStack = [];
      this.redoStack = [];
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

    async initializeComponent() {
      this.isFirstLoad = true;  // 새 슬라이드 로드 시 플래그 리셋
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

      // Undo/Redo 버튼 처리
      if (selectedIcon.name === "fa-rotate-left") {
        this.undo();
        return;
      } else if (selectedIcon.name === "fa-rotate-right") {
        this.redo();
        return;
      }

      if (selectedIcon.name === "fa-circle-minus") {
        // 알람이 활성화 되었다면
        if (
          this.showAiAlert &&
          !confirm("정말로 모든 사각형을 삭제하시겠습니까?")
        )
          return;

        // Undo를 위해 현재 상태 저장
        this.saveStateForUndo();

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
      if (!this.is_ai_use || this.isLoadingAi) return;

      const cacheKey = `${this.assignmentType}/${this.src.split("/").pop()}`;

      try {
        this.isLoadingAi = true;
        let aiData;

        // Vuex Store 캐시에서 먼저 확인
        const cachedData = this.$store.getters.getAiDataByKey(cacheKey);
        if (cachedData) {
          aiData = cachedData;
        } else {
          // 캐시에 없으면 API 호출
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
          aiData = response.data;
          // Vuex Store 캐시에 저장
          this.$store.commit("setAiData", { key: cacheKey, data: aiData });
        }

        if (aiData.length === 0 && this.showAiAlert) {
          alert("AI 데이터가 없습니다.");
        }

        let newAiSquares = aiData.map((e) => ({
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
      } finally {
        this.isLoadingAi = false;
      }
    },

    // AI 데이터 프리페치 (백그라운드에서 다음/이전 이미지 데이터 미리 로드)
    async prefetchAiData(imageSrc) {
      if (!this.is_ai_use) return;

      const fileName = imageSrc.split("/").pop();
      const cacheKey = `${this.assignmentType}/${fileName}`;

      // Vuex Store에서 이미 캐시되었는지 확인
      if (this.$store.getters.getAiDataByKey(cacheKey)) return;

      try {
        const response = await this.$axios.get("/api/assignments/ai/", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
          params: {
            src: fileName,
            assignmentType: this.assignmentType,
            questionIndex: this.questionIndex,
          },
        });
        // Vuex Store에 캐시
        this.$store.commit("setAiData", { key: cacheKey, data: response.data });
      } catch (error) {
        // 프리페치 실패는 조용히 무시
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

      // 부모 컨테이너(.bbox-component__body)에서 크기 측정
      // canvas-container는 min-width:0으로 캔버스 크기에 따라 축소되므로 부모에서 측정
      const body = this.$el.querySelector(".bbox-component__body");
      if (!body) return;
      const bodyRect = body.getBoundingClientRect();

      // 가용 크기 계산 (ZoomLens 크기 + ShortcutHelp 크기 + gap 제외)
      const zoomLensWidth = this.zoomSize || 200;
      // 고정 너비 사용 (렌더링 타이밍 문제 방지)
      const helpWidth = this.helpCollapsed ? 28 : 180;
      const gap = 10; // gap between elements
      const totalGap = gap * 2; // canvas-zoomlens gap + zoomlens-help gap
      const availableWidth = bodyRect.width - zoomLensWidth - helpWidth - totalGap;
      const availableHeight = bodyRect.height;

      // 이전 scale 계산 (0이면 좌표 변환 스킵)
      const beforeScale = canvas.width > 0 ? canvas.width / this.originalWidth : 0;
      // 저장된 beforeCanvas의 scale (최초 로드용)
      const savedBeforeCanvasWidth = this.localBeforeCanvas.width;

      console.log('[DEBUG resizeCanvas] isFirstLoad:', this.isFirstLoad);
      console.log('[DEBUG resizeCanvas] savedBeforeCanvasWidth:', savedBeforeCanvasWidth);
      console.log('[DEBUG resizeCanvas] temporarySquares.length:', this.temporarySquares.length);

      // 이미지 비율에 맞게 캔버스 크기 계산
      const scaleX = availableWidth / this.originalWidth;
      const scaleY = availableHeight / this.originalHeight;
      const scale = Math.min(scaleX, scaleY);
      canvas.width = Math.floor(this.originalWidth * scale);
      canvas.height = Math.floor(this.originalHeight * scale);

      console.log('[DEBUG resizeCanvas] 새 canvas.width:', canvas.width);

      // 결과 저장
      this.localBeforeCanvas.width = canvas.width;
      this.localBeforeCanvas.height = canvas.height;
      this.canvasHeight = canvas.height;

      this.drawBackgroundImage();
      // 좌표 변환
      if (this.isFirstLoad && savedBeforeCanvasWidth > 0) {
        // 최초 로드 시: 저장된 beforeCanvas 기준으로 변환
        console.log('[DEBUG resizeCanvas] convertLoadedSquaresPosition 호출');
        this.convertLoadedSquaresPosition(savedBeforeCanvasWidth);
        this.isFirstLoad = false;
      } else if (beforeScale > 0) {
        // 리사이즈 시: 이전 캔버스 크기 기준으로 변환
        console.log('[DEBUG resizeCanvas] setSquaresPosition 호출');
        await this.setSquaresPosition({ x: 0, y: 0, scale: beforeScale });
      }
      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      if (!this.temporarySquares.length) return;

      // 안전 장치: beforePosition.scale이 0이면 변환 스킵
      if (!beforePosition.scale || beforePosition.scale <= 0) return;

      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);

      // 안전 장치: currentPosition.scale이 0이면 변환 스킵
      if (!currentPosition.scale || currentPosition.scale <= 0) return;

      const scaleRatio = currentPosition.scale / beforePosition.scale;

      this.temporarySquares.forEach((square) => {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });
    },

    // 로드된 좌표를 현재 캔버스 크기에 맞게 변환
    convertLoadedSquaresPosition(savedBeforeCanvasWidth) {
      console.log('[DEBUG] convertLoadedSquaresPosition 호출');
      console.log('[DEBUG] savedBeforeCanvasWidth:', savedBeforeCanvasWidth);
      console.log('[DEBUG] this.originalWidth:', this.originalWidth);
      console.log('[DEBUG] canvas.width:', this.$refs.canvas?.width);
      console.log('[DEBUG] temporarySquares:', JSON.stringify(this.temporarySquares));
      console.log('[DEBUG] beforeCanvas (props):', JSON.stringify(this.beforeCanvas));

      if (!this.temporarySquares.length) {
        console.log('[DEBUG] 스킵: temporarySquares 없음');
        return;
      }
      if (!savedBeforeCanvasWidth || !this.originalWidth) {
        console.log('[DEBUG] 스킵: savedBeforeCanvasWidth 또는 originalWidth 없음');
        return;
      }

      const canvas = this.$refs.canvas;
      if (!canvas || !canvas.width) {
        console.log('[DEBUG] 스킵: canvas 없음');
        return;
      }

      // 저장 당시 scale
      const savedScale = savedBeforeCanvasWidth / this.originalWidth;
      // 현재 scale
      const currentScale = canvas.width / this.originalWidth;

      console.log('[DEBUG] savedScale:', savedScale);
      console.log('[DEBUG] currentScale:', currentScale);

      // 같으면 변환 불필요
      if (Math.abs(savedScale - currentScale) < 0.001) {
        console.log('[DEBUG] 스킵: scale 동일');
        return;
      }

      const scaleRatio = currentScale / savedScale;
      console.log('[DEBUG] scaleRatio:', scaleRatio);

      this.temporarySquares.forEach((square, idx) => {
        // AI 박스는 원본 좌표로 저장되므로 제외
        if (square.isAI) return;

        const oldX = square.x, oldY = square.y;
        square.x = square.x * scaleRatio;
        square.y = square.y * scaleRatio;
        console.log(`[DEBUG] square[${idx}]: (${oldX}, ${oldY}) -> (${square.x}, ${square.y})`);
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

    handleRightClick(event) {
      if (!this.isRunning) return;

      const { x, y } = this.getCanvasCoordinates(event);

      // 이미지 영역 밖 클릭 방지
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imgWidth = this.originalWidth * scale;
      const imgHeight = this.originalHeight * scale;

      if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
        return;
      }

      // 우클릭으로 박스 삭제
      this.eraseSquare(x, y);
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

      // Undo를 위해 현재 상태 저장
      this.saveStateForUndo();

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
        // Undo를 위해 현재 상태 저장
        this.saveStateForUndo();

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

      // 확대경 업데이트 (원본 이미지 좌표로 변환)
      const { scale } = this.calculateImagePosition(canvas.width, canvas.height);
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

      if (closestSquare && this.eraserActive) {
        // 박스 크기를 이미지 스케일에 맞춰 조절 (이미지에 그려진 것처럼 비례)
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

      // 확대경 숨김
      this.isZoomActive = false;

      this.redrawSquares();
    },

    onHelpCollapseChange(collapsed) {
      this.helpCollapsed = collapsed;
      this.$nextTick(() => {
        this.resizeCanvas();
      });
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

      // Undo를 위해 현재 상태 저장
      this.saveStateForUndo();

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
          // 이미지 변경 시 Undo/Redo 히스토리 초기화
          this.clearHistory();
          await this.loadBackgroundImage();
          this.fetchLocalInfo();
          this.resizeCanvas();

          // AI 모드가 활성화되어 있으면 새 이미지의 AI 데이터 자동 로드
          if (this.showAiBoxes && this.is_ai_use) {
            await this.showTempAIBox();
          }
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
