<template>
  <div class="bbox-component">
    <div class="bbox-component__header">
      <i
        v-for="icon in iconList"
        :key="icon.name"
        :class="['fas', icon.name, { active: icon.active }]"
        @click="activateIcon(icon)"
      ></i>
    </div>
    <div class="bbox-component__body">
      <canvas @click="handleCanvasClick"></canvas>
    </div>
  </div>
</template>

<script>
export default {
  name: "BBoxComponent",

  data() {
    return {
      iconList: [
        { name: "fa-square", active: true },
        { name: "fa-eraser", active: false },
      ],
      squares: [],
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
    };
  },

  props: {
    src: {
      type: String,
      required: true,
    },
  },

  methods: {
    activateIcon(selectedIcon) {
      this.iconList.forEach((icon) => {
        icon.active = false;
      });
      selectedIcon.active = true;
    },

    loadBackgroundImage() {
      const img = new Image();
      img.onload = () => {
        this.setBackgroundImage(img);
        this.resizeCanvas();
      };
      img.src = this.src;
    },

    setBackgroundImage(img) {
      this.backgroundImage = img;
      this.originalWidth = img.width;
      this.originalHeight = img.height;
    },

    drawBackgroundImage() {
      if (!this.backgroundImage) return;

      const canvas = this.$el.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const { width, height } = canvas;
      const { x, y, scale } = this.calculateImagePosition(width, height);

      ctx.clearRect(0, 0, width, height);

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
      const x = canvasWidth / 2 - (this.originalWidth / 2) * scale;
      const y = canvasHeight / 2 - (this.originalHeight / 2) * scale;

      return { x, y, scale };
    },

    resizeCanvas() {
      const canvas = this.$el.querySelector("canvas");
      canvas.width = 0;
      canvas.height = 0;

      const { width, height } = this.$el
        .querySelector(".bbox-component__body")
        .getBoundingClientRect();

      canvas.width = width;
      canvas.height = height;

      // this.adjustSquaresPosition(width, height);
      this.drawBackgroundImage();
      this.redrawSquares();
    },

    adjustSquaresPosition(newWidth, newHeight) {
      const scale = Math.min(
        newWidth / this.originalWidth,
        newHeight / this.originalHeight
      );
      this.squares = this.squares.map((square) => ({
        x: square.x * scale,
        y: square.y * scale,
      }));
    },

    handleCanvasClick(event) {
      const { x, y } = this.getCanvasCoordinates(event);
      const eraserActive = this.iconList.find(
        (icon) => icon.name === "fa-eraser"
      ).active;

      eraserActive ? this.eraseSquare(x, y) : this.drawSquare(x, y);
    },

    drawSquare(x, y) {
      this.squares.push({ x, y });
      this.redrawSquares();
    },

    eraseSquare(mouseX, mouseY) {
      this.squares = this.squares.filter(
        (square) => !this.isSquareClicked(square, mouseX, mouseY)
      );
      this.redrawSquares();
    },

    redrawSquares() {
      this.drawBackgroundImage();
      const canvas = this.$el.querySelector("canvas");
      const ctx = canvas.getContext("2d");

      this.squares.forEach((square) => {
        ctx.fillStyle = "red";
        ctx.fillRect(square.x - 10, square.y - 10, 20, 20); // 사각형 중심 조정
      });
    },

    getCanvasCoordinates(event) {
      const canvas = this.$el.querySelector("canvas"); // canvas 객체를 정의합니다.
      const canvasRect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;

      return {
        x: (event.clientX - canvasRect.left) * scaleX,
        y: (event.clientY - canvasRect.top) * scaleY,
      };
    },

    isSquareClicked(square, x, y) {
      return (
        x >= square.x - 10 &&
        x <= square.x + 10 &&
        y >= square.y - 10 &&
        y <= square.y + 10
      );
    },
  },

  mounted() {
    this.loadBackgroundImage();
    window.addEventListener("resize", this.resizeCanvas);
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
  },

  watch: {
    src() {
      this.loadBackgroundImage();
    },
  },
};
</script>

<style scoped>
.bbox-component {
  width: 100%;
  display: flex;
  flex-direction: column;
}
.bbox-component__header {
  gap: 10px;
  display: flex;
  align-items: center;
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
  background-color: gray;
}
</style>
