<template>
  <div class="polygon-viewer">
    <div class="canvas-wrap">
      <canvas ref="canvas"></canvas>
    </div>
    <div class="footer">
      <strong>{{ fileName }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: "PolygonViewerComponent",
  props: {
    userPolygonsList: { type: Array, required: true, default: () => [] },
    src: { type: String, required: true, default: "" },
    questionIndex: { type: Number, required: true, default: 0 },
    sliderValue: { type: Number, required: false, default: 1 },
    updateSquares: { type: Function, required: false, default: () => {} },
    aiData: { type: Array, required: false, default: () => [] },
    score_percent: { type: Number, required: false, default: 50 },
  },
  data() {
    return {
      backgroundImage: null,
      originalWidth: 0,
      originalHeight: 0,
      localBeforeCanvas: { width: 0, height: 0 },
      localPolygons: [],
    };
  },
  computed: {
    fileName() {
      return this.src.split("/").pop();
    },
  },
  methods: {
    async initCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const img = await this.createImage(this.src);
      this.backgroundImage = img;
      this.originalWidth = img.width;
      this.originalHeight = img.height;
      this.resizeCanvas();
      this.computeLocalPolygons();
      this.redraw();
    },
    createImage(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    },
    calculateImagePosition(canvasWidth, canvasHeight) {
      const scale = Math.min(canvasWidth / this.originalWidth, canvasHeight / this.originalHeight);
      const x = (canvasWidth - this.originalWidth * scale) / 2;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },
    resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      // 부모 컨테이너 크기에 맞춤
      const body = this.$el.querySelector(".canvas-wrap").getBoundingClientRect();
      canvas.width = body.width;
      canvas.height = body.height;
      this.localBeforeCanvas = { width: canvas.width, height: canvas.height };
      this.redraw();
    },
    computeLocalPolygons() {
      const canvas = this.$refs.canvas;
      if (!canvas || !this.backgroundImage) return;
      const { width, height } = canvas;
      this.localPolygons = [];
      const targetPos = this.calculateImagePosition(width, height);
      for (const user of this.userPolygonsList || []) {
        const before = user.beforeCanvas || { width: this.originalWidth, height: this.originalHeight };
        const srcPos = this.calculateImagePosition(before.width || this.originalWidth, before.height || this.originalHeight);
        const scaleRatio = targetPos.scale / srcPos.scale;
        const color = user.color || "#FF0000";
        for (const poly of user.polygons || []) {
          const mappedPoints = (poly.points || []).map((pt) => ({
            x: (pt.x - srcPos.x) * scaleRatio + targetPos.x,
            y: (pt.y - srcPos.y) * scaleRatio + targetPos.y,
          }));
          this.localPolygons.push({
            points: mappedPoints,
            class: poly.class,
            questionIndex: poly.questionIndex,
            color,
          });
        }
      }
    },
    drawBackground() {
      const canvas = this.$refs.canvas;
      if (!canvas || !this.backgroundImage) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x, y, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      ctx.drawImage(this.backgroundImage, x, y, this.originalWidth * scale, this.originalHeight * scale);
    },
    redraw() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      this.drawBackground();
      const ctx = canvas.getContext("2d");
      ctx.lineWidth = 2;
      for (const poly of this.localPolygons) {
        if (poly.questionIndex !== this.questionIndex) continue;
        ctx.strokeStyle = poly.color || "#FF0000";
        ctx.fillStyle = this.withAlpha(poly.color || "#FF0000", 0.15);
        const pts = poly.points || [];
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
    withAlpha(hex, alpha) {
      // Accepts #RRGGBB or #RGB
      let r = 255, g = 0, b = 0;
      if (/^#([0-9a-f]{3}){1,2}$/i.test(hex)) {
        const c = hex.substring(1);
        if (c.length === 3) {
          r = parseInt(c[0]+c[0], 16);
          g = parseInt(c[1]+c[1], 16);
          b = parseInt(c[2]+c[2], 16);
        } else {
          r = parseInt(c.substring(0,2), 16);
          g = parseInt(c.substring(2,4), 16);
          b = parseInt(c.substring(4,6), 16);
        }
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },
  },
  async mounted() {
    await this.initCanvas();
    window.addEventListener("resize", this.resizeCanvas);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
  },
  watch: {
    async src(newVal, oldVal) {
      if (newVal !== oldVal) {
        await this.initCanvas();
      }
    },
    userPolygonsList: {
      handler() {
        this.computeLocalPolygons();
        this.redraw();
      },
      deep: true,
    },
    questionIndex() {
      this.redraw();
    },
  },
};
</script>

<style scoped>
.polygon-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.canvas-wrap {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}
canvas {
  width: 100%;
  height: 100%;
  min-height: 550px;
  background-color: #000;
}
.footer {
  padding: 5px;
  color: #fff;
  background: #000;
}
</style>
