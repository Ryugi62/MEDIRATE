<template>
  <div class="bbox-component">
    <div class="bbox-component__header">
      <span class="bbox-component__header__left">
        <label>
          <input type="checkbox" v-model="showAiAlert" />
          알림 표시
        </label>
        <label>
          <input type="checkbox" v-model="goNext" />
          Save시 Next
        </label>
      </span>

      <div class="icon-list">
        <i
          v-for="icon in iconList"
          :key="icon.name"
          :class="['fas', icon.name, { active: icon.active }]"
          @click="activateIcon(icon)"
          :aria-label="icon.explanation"
        >
          <span>({{ icon.explanation }})</span>
        </i>
      </div>

      <div class="bbox-component__actions">
        <button @click="applyMitosis">AI Apply</button>
        <button @click="commitChanges('bbox', goNext)">Save</button>
      </div>
    </div>
    <div class="bbox-component__body">
      <canvas
        ref="canvas"
        @click="handleCanvasClick"
        @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave"
        @mouseenter="redrawSquares"
        @contextmenu.prevent
        @contextmenu="redrawSquares"
      ></canvas>
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
    squares: { type: Array, required: true, default: () => [] },
    src: { type: String, required: true, default: "" },
    questionIndex: { type: Number, required: true, default: 0 },
    assignmentType: { type: String, required: true, default: "" },
    assignmentIndex: { type: Number, required: true, default: 0 },
    commitAssignmentChanges: { type: Function, required: true },
  },

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
      temporarySquares: [], // 임시 사각형 배열 추가
      goNext: true,
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
  },

  methods: {
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
        const aiIcon = this.iconList.find((icon) => icon.name === "fa-robot");
        this.activateIcon(aiIcon);
      } else if (event.ctrlKey && event.key === "e") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // eraser icon 활성화
        const eraserIcon = this.iconList.find(
          (icon) => icon.name === "fa-eraser"
        );
        this.activateIcon(eraserIcon);
      } else if (event.ctrlKey && event.key === "q") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // square icon 활성화
        const squareIcon = this.iconList.find(
          (icon) => icon.name === "fa-square"
        );
        this.activateIcon(squareIcon);
      } else if (event.ctrlKey && event.key === "d") {
        event.preventDefault(); // 브라우저 기본 동작 방지
        // circle-minus icon 활성화
        const circleMinusIcon = this.iconList.find(
          (icon) => icon.name === "fa-circle-minus"
        );
        this.activateIcon(circleMinusIcon);
      }
    },

    async fetchLocalInfo() {
      this.localBeforeCanvas = this.beforeCanvas;
      this.localSquares = [...this.squares];
      this.temporarySquares = [...this.squares]; // 임시 사각형 배열 초기화
    },

    async activateIcon(selectedIcon) {
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
                  square.isAI // 이 조건을 추가하여 isAI가 true인 경우만 필터링
              )
          );

          for (let i = 0; i < newAiSquares.length; i++) {
            for (let j = i + 1; j < newAiSquares.length; j++) {
              if (
                Math.abs(
                  newAiSquares[i].originalX - newAiSquares[j].originalX
                ) <= 5 &&
                Math.abs(
                  newAiSquares[i].originalY - newAiSquares[j].originalY
                ) <= 5
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
          selectedIcon = this.iconList.find(
            (icon) => icon.name === "fa-square"
          );

          if (this.showAiAlert) {
            alert("AI 데이터 파일이 존재하는지 확인해주세요.");
          }

          console.error(error);
        }
      }
      this.resizeCanvas();
      this.iconList = this.iconList.map((icon) => ({
        ...icon,
        active: icon === selectedIcon,
      }));
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
      const { x, y } = this.getCanvasCoordinates(event);
      this.eraserActive ? this.eraseSquare(x, y) : this.drawSquare(x, y);
    },

    drawSquare(x, y) {
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
        if (square.isTemporary) return; // 임시 박스는 그리지 않음
        ctx.lineWidth = 2;
        ctx.strokeStyle = square.isAI ? "#FFFF00" : "#FF0000";
        ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
      });

      if (event) {
        this.activeEnlarge(event);
        this.activeSquareCursor(event);
      }

      this.$emit("update:squares", this.temporarySquares);
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
      this.temporarySquares = [
        ...this.temporarySquares,
        ...this.aiSquares.map((square) => ({
          ...square,
          isTemporaryAI: false,
          isAI: true,
        })),
      ];
      this.redrawSquares();
    },

    commitChanges(type, goNext) {
      this.localSquares = [...this.temporarySquares];
      this.commitAssignmentChanges(type, goNext);
    },
  },

  mounted() {
    this.fetchLocalInfo();
    this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
    window.addEventListener("keydown", this.handleHotkeys);
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
    window.removeEventListener("keydown", this.handleHotkeys);
  },

  watch: {
    src(newVal, oldVal) {
      if (newVal !== oldVal) this.loadBackgroundImage();

      const squareIcon = this.iconList.find(
        (icon) => icon.name === "fa-square"
      );

      this.activateIcon(squareIcon);
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
  padding: 10px;
}

.bbox-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
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

.bbox-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  background-color: #000;
  border: 1px solid #ccc;
  transition: border 0.3s;
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

.bbox-component__header__left {
  display: flex;
  gap: 8px;
}
</style>
