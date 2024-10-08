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
    score_percent: {
      type: Number,
      required: true,
      default: 50,
    },
  },

  data() {
    return {
      localBeforeCanvas: { width: null, height: null },
      originalLocalSquares: [],
      localSquares: [],
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
      aiSquares: [],
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

      this.localSquares = []; // 기존 데이터 초기화

      for (const user of this.userSquaresList) {
        if (!user.beforeCanvas.width || !user.beforeCanvas.height) {
          user.beforeCanvas.width = img.width;
          user.beforeCanvas.height = img.height;
        }

        const beforePosition = this.calculateImagePosition(width, height);
        const userBeforePosition = this.calculateImagePosition(
          user.beforeCanvas.width,
          user.beforeCanvas.height
        );
        const scaleRatio = beforePosition.scale / userBeforePosition.scale;

        for (const square of user.squares) {
          const localSquare = JSON.parse(JSON.stringify(square)); // 깊은 복사
          localSquare.color = user.color;
          localSquare.x =
            (square.x - userBeforePosition.x) * scaleRatio + beforePosition.x;
          localSquare.y =
            (square.y - userBeforePosition.y) * scaleRatio + beforePosition.y;
          this.localSquares.push(localSquare);
        }
      }

      const {
        x: imgX,
        y: imgY,
        scale,
      } = this.calculateImagePosition(width, height);
      this.aiSquares = this.aiData.map((square) => ({
        x: square.x * scale + imgX,
        y: square.y * scale + imgY,
        questionIndex: square.questionIndex,
        isAI: true,
        color: "#FFFF00",
        score: square.score,
      }));

      this.originalLocalSquares = this.localSquares.map((square) =>
        JSON.parse(JSON.stringify(square))
      ); // 깊은 복사
      this.updateSquares([...this.localSquares]);
    },

    async filterSquares() {
      // 원본 이미지 좌표로 변환
      const adjustedSquares = this.originalLocalSquares
        .filter(
          (square) =>
            square.questionIndex === this.questionIndex && !square.isTemporary
        )
        .map((square) => {
          const { x, y } = this.convertToOriginalImageCoordinates(
            square.x,
            square.y,
            this.localBeforeCanvas.width,
            this.localBeforeCanvas.height,
            this.originalWidth,
            this.originalHeight
          );
          return { ...square, x, y };
        });

      // 그룹화 진행
      const groups = [];
      const visited = new Set();

      const dfs = (square, group) => {
        if (visited.has(square)) return;
        visited.add(square);
        group.push(square);

        adjustedSquares.forEach((otherSquare) => {
          if (
            !visited.has(otherSquare) &&
            Math.abs(square.x - otherSquare.x) <= 12.5 &&
            Math.abs(square.y - otherSquare.y) <= 12.5 &&
            square.color !== otherSquare.color
          ) {
            dfs(otherSquare, group);
          }
        });
      };

      adjustedSquares.forEach((square) => {
        if (!visited.has(square)) {
          const group = [];
          dfs(square, group);
          groups.push(group);
        }
      });

      const filteredGroups = groups.filter(
        (group) => group.length >= this.sliderValue
      );

      // 다시 캔버스 좌표로 변환하여 렌더링
      this.localSquares = filteredGroups.flat().map((square) => {
        const { x, y } = this.convertToCanvasCoordinates(
          square.x,
          square.y,
          this.localBeforeCanvas.width,
          this.localBeforeCanvas.height,
          this.originalWidth,
          this.originalHeight
        );
        return { ...square, x, y };
      });

      this.redrawSquares();
      this.updateSquares([...this.localSquares]);
    },

    convertToOriginalImageCoordinates(x, y, canvasWidth, canvasHeight) {
      const currentPosition = this.calculateImagePosition(
        canvasWidth,
        canvasHeight
      );
      const scaleRatio = 1 / currentPosition.scale;

      const adjustedX = (x - currentPosition.x) * scaleRatio;
      const adjustedY = (y - currentPosition.y) * scaleRatio;

      return { x: adjustedX, y: adjustedY };
    },

    convertToCanvasCoordinates(x, y, canvasWidth, canvasHeight) {
      const currentPosition = this.calculateImagePosition(
        canvasWidth,
        canvasHeight
      );

      const adjustedX = x * currentPosition.scale + currentPosition.x;
      const adjustedY = y * currentPosition.scale + currentPosition.y;

      return { x: adjustedX, y: adjustedY };
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

      if (this.localBeforeCanvas.width && this.localBeforeCanvas.height) {
        canvas.width = this.localBeforeCanvas.width;
        canvas.height = this.localBeforeCanvas.height;
      }

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

      this.redrawSquares();
    },

    setSquaresPosition(beforePosition) {
      const { width, height } = this.$refs.canvas;
      const currentPosition = this.calculateImagePosition(width, height);
      const scaleRatio = currentPosition.scale / beforePosition.scale;

      for (const square of this.localSquares) {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      }

      for (const square of this.aiSquares) {
        square.x =
          (square.x - beforePosition.x) * scaleRatio + currentPosition.x;
        square.y =
          (square.y - beforePosition.y) * scaleRatio + currentPosition.y;
      }
    },

    redrawSquares(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");

      this.localSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex || square.isTemporary)
          return;

        ctx.lineWidth = 2;
        ctx.strokeStyle = square.color || "#FF0000";
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(square.x - 12.5, square.y - 12.5, 25, 25);
        ctx.globalAlpha = 1;
      });

      this.aiSquares.forEach((square) => {
        if (square.questionIndex !== this.questionIndex) return;
        if (square.score < this.score_percent / 100) return;
        ctx.lineWidth = 2;
        ctx.strokeStyle = square.color;
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
    async src(newVal, oldVal) {
      if (newVal !== oldVal) {
        await this.fetchLocalInfo();
        await this.filterSquares();
        await this.loadBackgroundImage();
        this.redrawSquares();
      }
    },

    isSliderActive() {
      this.resizeCanvas();
    },

    async sliderValue() {
      await this.filterSquares();
      this.redrawSquares();
    },

    aiData: {
      handler(newAiData) {
        const { width, height } = this.$refs.canvas.getBoundingClientRect();
        const {
          x: imgX,
          y: imgY,
          scale,
        } = this.calculateImagePosition(width, height);
        this.aiSquares = newAiData.map((square) => ({
          x: square.x * scale + imgX,
          y: square.y * scale + imgY,
          questionIndex: square.questionIndex,
          isAI: true,
          color: "#FFFF00",
          score: square.score,
        }));
        this.redrawSquares();
      },
      deep: true,
    },

    score_percent() {
      this.redrawSquares();
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
