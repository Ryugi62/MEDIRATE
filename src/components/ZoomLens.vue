<template>
  <div class="zoom-lens" :style="{ width: width + 'px', height: height + 'px' }">
    <canvas v-show="isActive" ref="zoomCanvas"></canvas>
    <div v-show="!isActive" class="zoom-placeholder">
      <i class="fas fa-search-plus"></i>
      <span>캔버스에 마우스를 올려주세요</span>
    </div>
  </div>
</template>

<script>
export default {
  name: "ZoomLens",

  props: {
    // 원본 이미지 객체
    image: {
      type: [HTMLImageElement, Object],
      default: null,
    },
    // 원본 이미지 기준 마우스 X 좌표
    mouseX: {
      type: Number,
      default: 0,
    },
    // 원본 이미지 기준 마우스 Y 좌표
    mouseY: {
      type: Number,
      default: 0,
    },
    // 확대경 너비
    width: {
      type: Number,
      default: 280,
    },
    // 확대경 높이
    height: {
      type: Number,
      default: 280,
    },
    // 확대 배율
    zoomLevel: {
      type: Number,
      default: 2.0,
    },
    // 활성화 여부
    isActive: {
      type: Boolean,
      default: false,
    },
  },

  watch: {
    mouseX() {
      this.drawZoom();
    },
    mouseY() {
      this.drawZoom();
    },
    image() {
      this.initCanvas();
    },
    width() {
      this.initCanvas();
      this.drawZoom();
    },
    height() {
      this.initCanvas();
      this.drawZoom();
    },
    isActive(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.initCanvas();
          this.drawZoom();
        });
      }
    },
  },

  mounted() {
    this.initCanvas();
  },

  methods: {
    initCanvas() {
      const canvas = this.$refs.zoomCanvas;
      if (!canvas) return;
      canvas.width = this.width;
      canvas.height = this.height;
    },

    drawZoom() {
      const canvas = this.$refs.zoomCanvas;
      if (!canvas || !this.image) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, this.width, this.height);

      // 캡처할 원본 이미지 영역 크기 (너비 기준)
      const sourceWidth = this.width / this.zoomLevel;
      const sourceHeight = this.height / this.zoomLevel;

      // 원본 이미지에서 캡처할 영역 (마우스 위치 중심)
      const sourceX = this.mouseX - sourceWidth / 2;
      const sourceY = this.mouseY - sourceHeight / 2;

      // 확대된 이미지 그리기
      ctx.drawImage(
        this.image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        this.width,
        this.height
      );

      // 중앙 십자선 그리기
      this.drawCrosshair(ctx);
    },

    drawCrosshair(ctx) {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const lineLength = 20;

      ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
      ctx.lineWidth = 1;

      // 가로선
      ctx.beginPath();
      ctx.moveTo(centerX - lineLength, centerY);
      ctx.lineTo(centerX + lineLength, centerY);
      ctx.stroke();

      // 세로선
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - lineLength);
      ctx.lineTo(centerX, centerY + lineLength);
      ctx.stroke();
    },
  },
};
</script>

<style scoped>
.zoom-lens {
  border: 2px solid #333;
  border-radius: 4px;
  background: #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.zoom-lens canvas {
  display: block;
}

.zoom-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  gap: 8px;
}

.zoom-placeholder i {
  font-size: 32px;
  opacity: 0.5;
}

.zoom-placeholder span {
  font-size: 12px;
  text-align: center;
  padding: 0 10px;
}
</style>
