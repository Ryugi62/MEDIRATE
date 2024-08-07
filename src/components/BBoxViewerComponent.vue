<template>
  <div class="bbox-component">
    <div class="bbox-component__body">
      <canvas
        ref="canvas"
        @mousemove="handleCanvasMouseMove"
        @resize="resizeCanvas"
        @mouseleave="redrawSquares"
      ></canvas>
    </div>
    <div class="bbox-component__footer">
      <strong>{{ getFileNameFromSrc() }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: "BBoxViewerComponent",

  props: {
    userSquaresList: {
      type: Array,
      required: true,
      default: () => [],
    },
    src: {
      type: String,
      required: true,
      default: "",
    },
    questionIndex: {
      type: Number,
      required: true,
      default: 0,
    },
    sliderValue: {
      type: Number,
      required: true,
      default: 0,
    },
    updateSquares: {
      type: Function,
      required: true,
      default: () => {},
    },
    aiData: {
      type: Array,
      required: true,
      default: () => [],
    },
  },

  data() {
    return {
      localBeforeCanvas: { width: null, height: null },
      originalLocalSquares: [],
      localSquares: [],
      localAiSquares: [], // 새로운 AI 데이터 저장 배열
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
    };
  },

  computed: {
    isSliderActive() {
      return this.$store.getters.isSlideBarOpen;
    },
  },

  methods: {
    async fetchLocalInfo() {
      const { width, height } = this.$refs.canvas.getBoundingClientRect();
      const img = await this.createImage(this.src);
      this.setBackgroundImage(img);
      this.localBeforeCanvas = { width, height };

      this.localSquares = [];

      for (const user of this.userSquaresList) {
        const beforePosition = this.calculateImagePosition(width, height);
        const userBeforePosition = this.calculateImagePosition(
          user.beforeCanvas.width,
          user.beforeCanvas.height
        );
        const scaleRatio = beforePosition.scale / userBeforePosition.scale;

        for (const square of user.squares) {
          const adjustedSquare = {
            ...square,
            color: user.color,
            x:
              (square.x - userBeforePosition.x) * scaleRatio + beforePosition.x,
            y:
              (square.y - userBeforePosition.y) * scaleRatio + beforePosition.y,
          };
          this.localSquares.push(adjustedSquare);
        }
      }

      this.processAiData();

      this.originalLocalSquares = [...this.localSquares];
      this.updateSquares([...this.localSquares]);
    },

    processAiData() {
      const { width, height } = this.$refs.canvas;
      const { x, y, scale } = this.calculateImagePosition(width, height);

      this.localAiSquares = this.aiData
        .filter((aiSquare) => aiSquare.questionIndex === this.questionIndex)
        .map((aiSquare) => ({
          x: aiSquare.x * scale + x,
          y: aiSquare.y * scale + y,
          questionIndex: aiSquare.questionIndex,
          isAI: true,
        }));
    },

    async filterSquares() {
      // AI 데이터는 필터링하지 않습니다.
      const filteredUserSquares = this.filterUserSquares([
        ...this.originalLocalSquares,
      ]);
      this.localSquares = filteredUserSquares;
      this.redrawSquares();
      this.updateSquares([...this.localSquares]);
    },

    filterUserSquares(squares) {
      const groups = [];
      const visited = new Set();

      const dfs = (square, group) => {
        if (visited.has(square)) return;
        visited.add(square);
        group.push(square);

        squares.forEach((otherSquare) => {
          if (
            !visited.has(otherSquare) &&
            Math.abs(square.x - otherSquare.x) <= 12.5 &&
            Math.abs(square.y - otherSquare.y) <= 12.5
          ) {
            dfs(otherSquare, group);
          }
        });
      };

      squares.forEach((square) => {
        if (!visited.has(square)) {
          const group = [];
          dfs(square, group);
          if (group.length >= this.sliderValue) {
            groups.push(group);
          }
        }
      });

      return groups.flat();
    },

    async loadBackgroundImage() {
      const img = await this.createImage(this.src);
      this.setBackgroundImage(img);
      this.resizeCanvas();
    },

    createImage(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
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

    resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;

      const beforePosition = this.calculateImagePosition(
        canvas.width,
        canvas.height
      );

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
      this.setSquaresPosition(beforePosition);
      this.setAiSquaresPosition(beforePosition);

      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale;

      this.localSquares.forEach((square) => {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      });
    },

    setAiSquaresPosition(beforePosition) {
      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);

      this.localAiSquares.forEach((square) => {
        square.x =
          ((square.x - beforePosition.x) / beforePosition.scale) *
            currentPosition.scale +
          currentPosition.x;
        square.y =
          ((square.y - beforePosition.y) / beforePosition.scale) *
            currentPosition.scale +
          currentPosition.y;
      });
    },

    redrawSquares(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");

      // 사용자 사각형 그리기
      this.localSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        ctx.lineWidth = 2;
        ctx.strokeStyle = square.color || "#FF0000";
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
        ctx.globalAlpha = 1;
      });

      // AI 사각형 그리기
      this.localAiSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFFF00";
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
        ctx.globalAlpha = 1;
      });

      if (event) {
        this.activeEnlarge(event);
        this.activeSquareCursor(event);
      }

      this.$emit("update:squares", this.localSquares);
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
      this.redrawSquares(event);
    },

    activeEnlarge(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const zoomWidth = 200;
      const zoomHeight = 200;
      const zoomLevel = 2.5;

      const enlargePosition = this.getEnlargePosition(
        x,
        canvas.width,
        zoomWidth
      );
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
      ctx.rect(enlargePosition.x, enlargePosition.y, zoomWidth, zoomHeight);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        enlargePosition.x,
        enlargePosition.y,
        zoomWidth,
        zoomHeight
      );

      ctx.restore();
    },

    getEnlargePosition(mouseX, canvasWidth, zoomWidth) {
      let positionX = canvasWidth - zoomWidth;
      let positionY = 0;

      return { x: positionX, y: positionY };
    },

    activeSquareCursor(event) {
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      const { x, y } = this.getCanvasCoordinates(event);
      const squareSize = 25;

      const cursorX = x - squareSize / 2;
      const cursorY = y - squareSize / 2;

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "white";
      ctx.strokeRect(cursorX, cursorY, squareSize, squareSize);
    },

    getFileNameFromSrc() {
      return this.src.split("/").pop();
    },
  },

  async mounted() {
    await this.fetchLocalInfo();
    await this.filterSquares();
    await this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
  },

  watch: {
    src(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.loadBackgroundImage();
        this.updateSquares([...this.localSquares]);
        this.processAiData();
      }
    },

    isSliderActive() {
      this.resizeCanvas();
    },

    async sliderValue() {
      await this.filterSquares();
    },

    aiData: {
      handler() {
        this.processAiData();
        this.redrawSquares();
      },
      deep: true,
    },
  },
};
</script>

<style scoped>
.bbox-component {
  flex: 1;
  display: flex;
  padding-right: 22px;
  flex-direction: column;
}

.bbox-component__header,
.bbox-component__footer {
  display: flex;
  justify-content: center;
}

.bbox-component__header i {
  cursor: pointer;
  padding: 10px;
}

.bbox-component__header i.active {
  color: var(--blue);
}

.bbox-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  background-color: rgb(0, 0, 0);
}

.bbox-component__footer {
  padding: 5px;
  color: white;
  background-color: black;
}
</style>
