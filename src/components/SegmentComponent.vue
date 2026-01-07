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
            disabled: !isRunning || isIconDisabled(icon.name),
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
          @mousedown="handleCanvasMouseDown"
          @mouseup="handleCanvasMouseUp"
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
      <ShortcutHelp
        :operations="helpOperations"
        :shortcuts="helpShortcuts"
        @collapse-change="onHelpCollapseChange"
      />
    </div>
    <div class="segment-component__footer">
      <strong>{{ fileName }}</strong>
      <span class="polygon-count">폴리곤: {{ currentPolygonCount }}개</span>
    </div>
  </div>
</template>

<script>
import ZoomLens from "./ZoomLens.vue";
import ShortcutHelp from "./ShortcutHelp.vue";
import polygonClipping from "polygon-clipping";

export default {
  name: "SegmentComponent",
  components: {
    ZoomLens,
    ShortcutHelp,
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
        { name: "fa-draw-polygon", active: true, explanation: "점 찍기" },
        { name: "fa-pen", active: false, explanation: "자유곡선" },
        { name: "fa-scissors", active: false, explanation: "잘라내기" },
        { name: "fa-brush", active: false, explanation: "자유 잘라내기" },
        { name: "fa-rotate-left", active: false, explanation: "되돌리기" },
        { name: "fa-rotate-right", active: false, explanation: "다시실행" },
        { name: "fa-circle-minus", active: false, explanation: "전체삭제" },
      ],
      localBeforeCanvas: {},
      localPolygons: [],
      temporaryPolygons: [],
      currentPoints: [], // 현재 그리고 있는 폴리곤의 점들
      // 자유곡선 관련
      isDrawingFreehand: false,
      freehandSampleDistance: 8, // 매 8px마다 점 추가 (더 부드러운 곡선)
      lastFreehandPoint: null,
      // 잘라내기 관련
      currentCutoutPoints: [],
      // Undo/Redo 관련
      undoStack: [],
      redoStack: [],
      maxHistorySize: 50,
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
      // 단축키 도움말
      helpOperations: [
        { action: "좌클릭", description: "점 추가" },
        { action: "드래그", description: "자유곡선 그리기" },
        { action: "우클릭", description: "폴리곤 완성" },
      ],
      helpShortcuts: [
        { key: "ESC", description: "취소" },
        { key: "Ctrl+F", description: "자유곡선" },
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
    freehandActive() {
      return this.iconList.some(
        (icon) => icon.name === "fa-pen" && icon.active
      );
    },
    cutoutActive() {
      return this.iconList.some(
        (icon) => icon.name === "fa-scissors" && icon.active
      );
    },
    freehandCutoutActive() {
      return this.iconList.some(
        (icon) => icon.name === "fa-brush" && icon.active
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
      // 비활성화된 아이콘 클릭 무시
      if (this.isIconDisabled(icon.name)) {
        return;
      }
      this.activateIcon(icon);
    },

    isIconDisabled(iconName) {
      if (iconName === "fa-rotate-left") {
        return this.undoStack.length === 0 && this.currentPoints.length === 0;
      }
      if (iconName === "fa-rotate-right") {
        return this.redoStack.length === 0;
      }
      return false;
    },

    handleHotkeys(event) {
      // ESC: 현재 그리기 작업 취소
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelCurrentDrawing();
        return;
      }

      if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        this.commitChanges("segment", this.goNext);
      } else if (event.ctrlKey && event.shiftKey && event.key === "Z") {
        // Ctrl+Shift+Z: Redo (Shift 누르면 대문자 "Z"가 됨)
        event.preventDefault();
        this.redo();
      } else if (event.ctrlKey && event.key === "z") {
        // Ctrl+Z: Undo
        event.preventDefault();
        this.undo();
      } else if (event.ctrlKey && event.key === "f") {
        event.preventDefault();
        // 자유곡선 모드 토글
        const penIcon = this.iconList.find((icon) => icon.name === "fa-pen");
        if (penIcon) {
          this.handleIconClick(penIcon);
        }
      } else if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        this.clearAllPolygons();
      }
    },

    // 현재 그리기 작업 취소
    cancelCurrentDrawing() {
      // 자유곡선 드래그 중이면 중단
      if (this.isDrawingFreehand) {
        this.isDrawingFreehand = false;
        this.lastFreehandPoint = null;
      }

      // 점 찍기 중이면 취소
      if (this.currentPoints.length > 0) {
        this.currentPoints = [];
      }

      // 잘라내기 중이면 취소
      if (this.currentCutoutPoints.length > 0) {
        this.currentCutoutPoints = [];
      }

      this.redrawCanvas();
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
      // 즉시 실행 버튼들 (모드 전환 없음)
      if (selectedIcon.name === "fa-circle-minus") {
        if (this.showAlert && !confirm("정말로 모든 폴리곤을 삭제하시겠습니까?")) {
          return;
        }
        this.clearAllPolygons();
        return;
      }

      if (selectedIcon.name === "fa-rotate-left") {
        this.undo();
        return;
      }

      if (selectedIcon.name === "fa-rotate-right") {
        this.redo();
        return;
      }

      // 모드 전환 시 진행 중인 작업 취소
      this.cancelCurrentDrawing();

      this.iconList = this.iconList.map((icon) => ({
        ...icon,
        active: icon === selectedIcon,
      }));
      this.redrawCanvas();
    },

    clearAllPolygons() {
      this.saveStateForUndo();
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

    // Undo/Redo 관련 메서드
    saveStateForUndo() {
      // 현재 questionIndex의 폴리곤만 스냅샷
      const snapshot = JSON.parse(JSON.stringify(
        this.temporaryPolygons.filter(p => p.questionIndex === this.questionIndex)
      ));

      this.undoStack.push(snapshot);
      this.redoStack = []; // 새 작업 시 redo 스택 초기화

      // 최대 크기 제한
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }
    },

    undo() {
      // 그리는 중이면 점 취소
      if (this.currentPoints.length > 0) {
        this.undoLastPoint();
        return;
      }

      if (this.undoStack.length === 0) return;

      // 현재 상태를 redo 스택에 저장
      const currentState = this.temporaryPolygons.filter(
        p => p.questionIndex === this.questionIndex
      );
      this.redoStack.push(JSON.parse(JSON.stringify(currentState)));

      // 이전 상태 복원
      const previousState = this.undoStack.pop();

      // 다른 question의 폴리곤 유지 + 복원된 폴리곤
      const otherPolygons = this.temporaryPolygons.filter(
        p => p.questionIndex !== this.questionIndex
      );
      this.temporaryPolygons = [...otherPolygons, ...previousState];

      this.redrawCanvas();
    },

    redo() {
      if (this.redoStack.length === 0) return;

      // 현재 상태를 undo 스택에 저장
      const currentState = this.temporaryPolygons.filter(
        p => p.questionIndex === this.questionIndex
      );
      this.undoStack.push(JSON.parse(JSON.stringify(currentState)));

      // 다음 상태 복원
      const nextState = this.redoStack.pop();

      const otherPolygons = this.temporaryPolygons.filter(
        p => p.questionIndex !== this.questionIndex
      );
      this.temporaryPolygons = [...otherPolygons, ...nextState];

      this.redrawCanvas();
    },

    clearHistory() {
      this.undoStack = [];
      this.redoStack = [];
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

      // 자유곡선/자유잘라내기 모드에서는 click 이벤트 무시 (mousedown/up으로 처리)
      if (this.freehandActive || this.freehandCutoutActive) return;

      const { x, y } = this.getCanvasCoordinates(event);

      // 이미지 영역 밖 클릭 방지
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imgWidth = this.originalWidth * scale;
      const imgHeight = this.originalHeight * scale;

      if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
        return; // 이미지 영역 밖이면 무시
      }

      if (this.cutoutActive) {
        this.addCutoutPoint(x, y);
      } else {
        this.addPoint(x, y);
      }
    },

    handleCanvasMouseDown(event) {
      if (!this.isRunning) return;
      // 자유곡선 또는 자유 잘라내기 모드에서만 처리
      if (!this.freehandActive && !this.freehandCutoutActive) return;

      // 왼쪽 클릭만 처리
      if (event.button !== 0) return;

      const { x, y } = this.getCanvasCoordinates(event);
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      const imgWidth = this.originalWidth * scale;
      const imgHeight = this.originalHeight * scale;

      // 이미지 영역 밖이면 무시
      if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
        return;
      }

      // 자유곡선 잘라내기 모드
      if (this.freehandCutoutActive) {
        this.isDrawingFreehand = true;
        this.currentCutoutPoints = [];
        this.lastFreehandPoint = null;
        this.addFreehandCutoutPoint(x, y);
        return;
      }

      // 자유곡선 모드
      this.isDrawingFreehand = true;
      this.currentPoints = [];
      this.lastFreehandPoint = null;
      this.addFreehandPoint(x, y);
    },

    handleCanvasMouseUp() {
      if (!this.isDrawingFreehand) return;

      this.isDrawingFreehand = false;

      // 자유곡선 잘라내기 모드
      if (this.freehandCutoutActive) {
        if (this.currentCutoutPoints.length >= 3) {
          // 스무딩 후 단순화
          const smoothed = this.smoothPoints(this.currentCutoutPoints, 2);
          const simplified = this.simplifyPoints(smoothed, 1.5);
          this.currentCutoutPoints = simplified;
          this.completeCutout();
        } else {
          this.currentCutoutPoints = [];
        }
        this.lastFreehandPoint = null;
        this.redrawCanvas();
        return;
      }

      // 자유곡선 모드
      if (!this.freehandActive) return;

      // 폴리곤 완성 (최소 3점 필요)
      if (this.currentPoints.length >= 3) {
        // 스무딩 후 단순화
        const smoothed = this.smoothPoints(this.currentPoints, 2);
        const simplifiedPoints = this.simplifyPoints(smoothed, 1.5);

        this.saveStateForUndo();
        this.temporaryPolygons.push({
          questionIndex: this.questionIndex,
          points: simplifiedPoints,
          isTemporary: false,
        });
      }

      this.currentPoints = [];
      this.lastFreehandPoint = null;
      this.redrawCanvas();
    },

    addFreehandPoint(canvasX, canvasY) {
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const originalX = (canvasX - imgX) / scale;
      const originalY = (canvasY - imgY) / scale;

      // 마지막 점과의 거리 체크 (샘플링)
      if (this.lastFreehandPoint) {
        const dist = Math.hypot(
          originalX - this.lastFreehandPoint.x,
          originalY - this.lastFreehandPoint.y
        );
        if (dist < this.freehandSampleDistance) return;
      }

      this.currentPoints.push({ x: originalX, y: originalY });
      this.lastFreehandPoint = { x: originalX, y: originalY };
      this.redrawCanvas();
    },

    // 자유곡선 잘라내기용 점 추가
    addFreehandCutoutPoint(canvasX, canvasY) {
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const originalX = (canvasX - imgX) / scale;
      const originalY = (canvasY - imgY) / scale;

      // 마지막 점과의 거리 체크 (샘플링)
      if (this.lastFreehandPoint) {
        const dist = Math.hypot(
          originalX - this.lastFreehandPoint.x,
          originalY - this.lastFreehandPoint.y
        );
        if (dist < this.freehandSampleDistance) return;
      }

      this.currentCutoutPoints.push({ x: originalX, y: originalY });
      this.lastFreehandPoint = { x: originalX, y: originalY };
      this.redrawCanvas();
    },

    // Douglas-Peucker 알고리즘으로 점 단순화
    simplifyPoints(points, tolerance = 2) {
      if (points.length <= 3) return points;

      const findFurthest = (start, end, points) => {
        let maxDist = 0;
        let index = -1;
        const line = { x1: points[start].x, y1: points[start].y, x2: points[end].x, y2: points[end].y };

        for (let i = start + 1; i < end; i++) {
          const dist = this.pointToLineDistance(points[i], line);
          if (dist > maxDist) {
            maxDist = dist;
            index = i;
          }
        }
        return { index, dist: maxDist };
      };

      const simplify = (start, end, points, result) => {
        const { index, dist } = findFurthest(start, end, points);

        if (dist > tolerance && index !== -1) {
          simplify(start, index, points, result);
          result.push(points[index]);
          simplify(index, end, points, result);
        }
      };

      const result = [points[0]];
      simplify(0, points.length - 1, points, result);
      result.push(points[points.length - 1]);

      return result;
    },

    pointToLineDistance(point, line) {
      const { x1, y1, x2, y2 } = line;
      const A = point.x - x1;
      const B = point.y - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = lenSq !== 0 ? dot / lenSq : -1;

      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      return Math.hypot(point.x - xx, point.y - yy);
    },

    // 스무딩: 이동 평균 필터로 곡선을 부드럽게
    smoothPoints(points, iterations = 2) {
      if (points.length < 3) return points;

      let result = [...points];

      for (let iter = 0; iter < iterations; iter++) {
        const smoothed = [result[0]]; // 첫 점 유지

        for (let i = 1; i < result.length - 1; i++) {
          // 이전, 현재, 다음 점의 가중 평균
          smoothed.push({
            x: result[i - 1].x * 0.25 + result[i].x * 0.5 + result[i + 1].x * 0.25,
            y: result[i - 1].y * 0.25 + result[i].y * 0.5 + result[i + 1].y * 0.25,
          });
        }

        smoothed.push(result[result.length - 1]); // 마지막 점 유지
        result = smoothed;
      }

      return result;
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

      this.saveStateForUndo();
      this.temporaryPolygons.push({
        questionIndex: this.questionIndex,
        points: [...this.currentPoints],
        isTemporary: false,
      });

      this.currentPoints = [];
      this.redrawCanvas();
    },

    // 잘라내기 점 추가 (점 찍기 모드)
    addCutoutPoint(canvasX, canvasY) {
      const canvas = this.$refs.canvas;
      const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);

      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const originalX = (canvasX - imgX) / scale;
      const originalY = (canvasY - imgY) / scale;

      // 첫 점 근처를 클릭하면 잘라내기 완성
      if (this.currentCutoutPoints.length >= 3) {
        const CUTOUT_CLOSE_THRESHOLD = 15;
        const firstPoint = this.currentCutoutPoints[0];
        const distance = Math.hypot(firstPoint.x - originalX, firstPoint.y - originalY);
        if (distance < CUTOUT_CLOSE_THRESHOLD) {
          this.completeCutout();
          return;
        }
      }

      // 점 추가
      this.currentCutoutPoints.push({ x: originalX, y: originalY });
      this.redrawCanvas();
    },

    // 잘라내기 완성 - 모든 폴리곤에 빼기 연산 적용
    completeCutout() {
      if (this.currentCutoutPoints.length < 3) {
        if (this.showAlert) {
          alert("잘라내기 영역은 최소 3개의 점이 필요합니다.");
        }
        return;
      }

      this.saveStateForUndo();

      // 잘라내기 영역을 polygon-clipping 형식으로 변환
      const clipPoly = [this.currentCutoutPoints.map(p => [p.x, p.y])];

      // 현재 questionIndex에 해당하는 폴리곤들만 처리
      const newPolygons = [];
      const otherPolygons = [];

      this.temporaryPolygons.forEach(polygon => {
        if (polygon.questionIndex !== this.questionIndex) {
          // 다른 질문의 폴리곤은 그대로 유지
          otherPolygons.push(polygon);
          return;
        }

        // polygon-clipping 형식으로 변환
        const subjectPoly = [polygon.points.map(p => [p.x, p.y])];

        try {
          // 폴리곤 빼기 연산 (difference)
          const result = polygonClipping.difference(subjectPoly, clipPoly);

          // 결과 폴리곤들 추가 (여러 개가 될 수 있음)
          const MIN_POLYGON_AREA = 100; // 최소 면적 (픽셀²) - 이보다 작으면 파편으로 간주
          result.forEach(multiPoly => {
            const outerRing = multiPoly[0];
            if (outerRing && outerRing.length >= 3) {
              const points = outerRing.map(coord => ({ x: coord[0], y: coord[1] }));
              const area = this.calculatePolygonArea(points);
              // 최소 면적 이상인 폴리곤만 추가
              if (area >= MIN_POLYGON_AREA) {
                newPolygons.push({
                  questionIndex: this.questionIndex,
                  points: points,
                  isTemporary: false,
                });
              }
            }
          });
        } catch (error) {
          console.error("폴리곤 잘라내기 오류:", error);
          // 오류 시 원본 유지
          newPolygons.push(polygon);
        }
      });

      // 폴리곤 배열 업데이트
      this.temporaryPolygons = [...otherPolygons, ...newPolygons];

      // 상태 초기화
      this.currentCutoutPoints = [];
      this.redrawCanvas();
    },

    // 특정 좌표에 있는 폴리곤 인덱스 찾기
    findPolygonAtPoint(x, y) {
      for (let i = this.temporaryPolygons.length - 1; i >= 0; i--) {
        const polygon = this.temporaryPolygons[i];
        if (polygon.questionIndex !== this.questionIndex) continue;
        if (this.isPointInPolygon(x, y, polygon.points)) {
          return i;
        }
      }
      return null;
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

    // 폴리곤 면적 계산 (Shoelace formula)
    calculatePolygonArea(points) {
      if (points.length < 3) return 0;
      let area = 0;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
      }
      return Math.abs(area / 2);
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

        // 각 점에 원 표시 (첫 점만 표시)
        if (canvasPoints.length > 0) {
          ctx.beginPath();
          ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFF00";
          ctx.fill();
        }
      }

      // 현재 그리고 있는 잘라내기 영역 그리기
      if (this.currentCutoutPoints.length > 0) {
        const canvasPoints = this.currentCutoutPoints.map(p => ({
          x: imgX + p.x * scale,
          y: imgY + p.y * scale
        }));
        this.drawPolygon(ctx, canvasPoints, "#FFA500", false, scale); // 주황색

        // 각 점에 원 표시 (첫 점만 표시)
        if (canvasPoints.length > 0) {
          ctx.beginPath();
          ctx.arc(canvasPoints[0].x, canvasPoints[0].y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFF00";
          ctx.fill();
        }
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

      // 자유곡선 모드: 드래그 중이면 점 추가
      if (this.freehandActive && this.isDrawingFreehand) {
        this.addFreehandPoint(x, y);
        return; // 미리보기 선 필요 없음
      }

      // 자유곡선 잘라내기 모드: 드래그 중이면 점 추가
      if (this.freehandCutoutActive && this.isDrawingFreehand) {
        this.addFreehandCutoutPoint(x, y);
        return; // 미리보기 선 필요 없음
      }

      this.redrawCanvas();

      // 현재 그리고 있는 폴리곤의 미리보기 선 (점 찍기 모드에서만)
      if (this.currentPoints.length > 0 && !this.freehandActive) {
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

    onHelpCollapseChange(collapsed) {
      this.helpCollapsed = collapsed;
      this.$nextTick(() => {
        this.resizeCanvas();
      });
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

    // 전역 mouseup 핸들러 (캔버스 밖에서 마우스 놓아도 처리)
    handleGlobalMouseUp() {
      if (this.isDrawingFreehand) {
        this.handleCanvasMouseUp();
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
    window.addEventListener("mouseup", this.handleGlobalMouseUp);

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
    window.removeEventListener("mouseup", this.handleGlobalMouseUp);
    this.clearTimerInterval();
  },

  watch: {
    src: {
      immediate: true,
      handler: async function (newVal, oldVal) {
        if (newVal !== oldVal) {
          this.clearHistory(); // 이미지 변경 시 히스토리 초기화
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
