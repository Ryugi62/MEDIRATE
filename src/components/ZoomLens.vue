<template>
  <div class="zoom-lens" v-show="isActive">
    <canvas ref="zoomCanvas"></canvas>
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
    // 확대경 크기 (정사각형)
    size: {
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
      canvas.width = this.size;
      canvas.height = this.size;
    },

    drawZoom() {
      const canvas = this.$refs.zoomCanvas;
      if (!canvas || !this.image) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, this.size, this.size);

      // 캡처할 원본 이미지 영역 크기
      const sourceSize = this.size / this.zoomLevel;

      // 원본 이미지에서 캡처할 영역 (마우스 위치 중심)
      const sourceX = this.mouseX - sourceSize / 2;
      const sourceY = this.mouseY - sourceSize / 2;

      // 확대된 이미지 그리기
      ctx.drawImage(
        this.image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        this.size,
        this.size
      );

      // 중앙 십자선 그리기
      this.drawCrosshair(ctx);
    },

    drawCrosshair(ctx) {
      const center = this.size / 2;
      const lineLength = 20;

      ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
      ctx.lineWidth = 1;

      // 가로선
      ctx.beginPath();
      ctx.moveTo(center - lineLength, center);
      ctx.lineTo(center + lineLength, center);
      ctx.stroke();

      // 세로선
      ctx.beginPath();
      ctx.moveTo(center, center - lineLength);
      ctx.lineTo(center, center + lineLength);
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
}

.zoom-lens canvas {
  display: block;
}
</style>
