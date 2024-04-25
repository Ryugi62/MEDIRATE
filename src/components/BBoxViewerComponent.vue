<template>
  <div class="bbox-component">
    <div class="bbox-component__body">
      <canvas
        ref="canvas"
        @mousemove="handleCanvasMouseMove"
        @resize="resizeCanvas"
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
  },

  data() {
    return {
      localBeforeCanvas: { width: null, height: null },
      originalLocalSquares: [],
      localSquares: [],
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

      for (const user of this.userSquaresList) {
        const beforePosition = this.calculateImagePosition(width, height);
        const userBeforePosition = this.calculateImagePosition(
          user.beforeCanvas.width,
          user.beforeCanvas.height
        );
        const scaleRatio = beforePosition.scale / userBeforePosition.scale;

        for (const square of user.squares) {
          square.color = user.color;
          square.x =
            (square.x - userBeforePosition.x) * scaleRatio + beforePosition.x;
          square.y =
            (square.y - userBeforePosition.y) * scaleRatio + beforePosition.y;
          this.localSquares.push(square);
        }
      }

      this.originalLocalSquares = [...this.localSquares];
      this.updateSquares([...this.localSquares]);
    },

    async filterSquares() {
      this.localSquares = [...this.originalLocalSquares];
      const squares = [];

      for (const square of this.localSquares) {
        const overlap = this.localSquares
          .filter((s) => {
            return (
              Math.abs(s.x - square.x) < 5 &&
              Math.abs(s.y - square.y) < 5 &&
              s.color !== square.color
            );
          })
          .filter(
            (s, index, self) =>
              index === self.findIndex((t) => t.color === s.color)
          );

        console.log(overlap);

        if (overlap.length + 1 >= this.sliderValue) squares.push(square);
      }

      this.localSquares = [...squares];
      this.redrawSquares();
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
    },

    redrawSquares(event = null) {
      this.drawBackgroundImage();
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");
      for (const square of this.localSquares) {
        if (square.questionIndex !== this.questionIndex) continue;
        if (square.isAI) continue;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = square.color;
        ctx.globalAlpha = 0.8;
        if (square.isAI) ctx.strokeStyle = "yellow";
        ctx.strokeRect(square.x - 10, square.y - 10, 20, 20);
        ctx.globalAlpha = 1; // Reset the globalAlpha value
      }

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
      const squareSize = 20;

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
      if (newVal !== oldVal) this.loadBackgroundImage();
    },

    isSliderActive() {
      this.resizeCanvas();
    },

    async sliderValue() {
      await this.filterSquares();
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
