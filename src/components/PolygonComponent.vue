<!-- PolygonComponent.vue -->
<template>
  <div class="polygon-component">
    <div class="polygon-component__header">
      <div class="icon-list">
        <i
          v-for="icon in iconList"
          :key="icon.name"
          :class="['fas', icon.name, { active: icon.active }]"
          @click="handleIconClick(icon)"
          :title="icon.explanation"
        >
          <span class="icon-explanation">({{ icon.explanation }})</span>
        </i>
      </div>

      <div class="polygon-actions" v-if="selectedPolygon">
        <label for="polygon-class">Class:</label>
        <select id="polygon-class" v-model="selectedPolygon.class" @change="redrawPolygons">
          <option v-for="c in availableClasses" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div class="component-actions">
        <button @click="commitChanges">Save</button>
      </div>
    </div>

    <div class="polygon-component__body">
      <canvas
        ref="canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseLeave"
        @contextmenu.prevent="handleRightClick"
      ></canvas>
    </div>
    <div class="polygon-component__footer">
      <strong>{{ fileName }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: "PolygonComponent",

  props: {
    polygons: { type: Array, required: true, default: () => [] },
    src: { type: String, required: true, default: "" },
    questionIndex: { type: Number, required: true, default: 0 },
  },

  emits: ["update:polygons", "commitAssignmentChanges"],

  data() {
    return {
      iconList: [
        { name: "fa-draw-polygon", active: true, explanation: "Add (추가)" },
        { name: "fa-eraser", active: false, explanation: "Delete (삭제)" },
        { name: "fa-circle-minus", active: false, explanation: "Clear All (전체 삭제)" },
      ],
      localPolygons: [],
      backgroundImage: null,
      originalWidth: null,
      originalHeight: null,
      
      isDrawing: false,
      currentPolygon: null,
      selectedPolygon: null,
      hoveredPoint: null,
      isDraggingPoint: false,
      
      availableClasses: ['Tumor', 'Stroma', 'Other'],
    };
  },

  computed: {
    addToolActive() {
      return this.iconList.find(icon => icon.name === 'fa-draw-polygon')?.active;
    },
    eraseToolActive() {
      return this.iconList.find(icon => icon.name === 'fa-eraser')?.active;
    },
    fileName() {
      return this.src ? this.src.split("/").pop() : "";
    },
  },

  methods: {
    // --- Initialization and Drawing ---
    async initialize() {
      this.localPolygons = JSON.parse(JSON.stringify(this.polygons));
      await this.loadBackgroundImage();
      this.resizeCanvas();
    },

    async loadBackgroundImage() {
      if (!this.src) return;
      try {
        const img = new Image();
        img.src = this.src;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        this.backgroundImage = img;
        this.originalWidth = img.width;
        this.originalHeight = img.height;
      } catch (error) {
        console.error("Error loading background image:", error);
      }
    },

    resizeCanvas() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      this.redrawPolygons();
    },

    redrawPolygons() {
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawBackgroundImage();

      const allPolygons = [...this.localPolygons, this.currentPolygon].filter(p => p);

      allPolygons.forEach(polygon => {
        if (polygon.questionIndex !== this.questionIndex) return;

        ctx.beginPath();
        const firstPoint = this.getCanvasCoordinates(polygon.points[0]);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < polygon.points.length; i++) {
          const point = this.getCanvasCoordinates(polygon.points[i]);
          ctx.lineTo(point.x, point.y);
        }

        if (polygon.isComplete) {
          ctx.closePath();
          ctx.fillStyle = this.getClassColor(polygon.class, 0.4);
          ctx.fill();
          ctx.strokeStyle = this.getClassColor(polygon.class, 1);
          ctx.lineWidth = (this.selectedPolygon === polygon) ? 3 : 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
        // Draw points
        polygon.points.forEach(p => {
            const canvasP = this.getCanvasCoordinates(p);
            ctx.beginPath();
            ctx.arc(canvasP.x, canvasP.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.stroke();
        });
      });
    },

    drawBackgroundImage() {
      const canvas = this.$refs.canvas;
      if (!this.backgroundImage || !canvas) return;
      const ctx = canvas.getContext("2d");
      const { x, y, scale } = this.calculateImagePosition(canvas.width, canvas.height);
      ctx.drawImage(this.backgroundImage, x, y, this.originalWidth * scale, this.originalHeight * scale);
    },

    // --- Event Handlers ---
    handleMouseDown(event) {
        if (event.button !== 0) return; // Only left click
        const mousePos = this.getMousePos(event);

        if (this.addToolActive) {
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.currentPolygon = {
                    id: Date.now(),
                    points: [this.getOriginalCoordinates(mousePos)],
                    class: 'Tumor',
                    isComplete: false,
                    questionIndex: this.questionIndex,
                };
            } else {
                // Add point to current polygon
                this.currentPolygon.points.push(this.getOriginalCoordinates(mousePos));
            }
        } else { // Select/Drag mode
            const pointInfo = this.getPointAt(mousePos);
            if (pointInfo) {
                this.isDraggingPoint = true;
                this.selectedPolygon = pointInfo.polygon;
                this.hoveredPoint = pointInfo.point;
            } else {
                const polygon = this.getPolygonAt(mousePos);
                this.selectedPolygon = polygon;
            }
        }
        this.redrawPolygons();
    },

    handleMouseMove(event) {
        const mousePos = this.getMousePos(event);
        if (this.isDrawing && this.currentPolygon) {
            // Live preview of the next line segment
            this.redrawPolygons();
            const ctx = this.$refs.canvas.getContext('2d');
            const lastPoint = this.getCanvasCoordinates(this.currentPolygon.points[this.currentPolygon.points.length - 1]);
            ctx.beginPath();
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.isDraggingPoint) {
            const originalPos = this.getOriginalCoordinates(mousePos);
            this.hoveredPoint.x = originalPos.x;
            this.hoveredPoint.y = originalPos.y;
            this.redrawPolygons();
        }
    },
    
    handleMouseUp(event) {
        if (event.button !== 0) return;
        this.isDraggingPoint = false;
        this.hoveredPoint = null;
    },

    handleRightClick() {
        if (this.isDrawing && this.currentPolygon && this.currentPolygon.points.length >= 3) {
            this.currentPolygon.isComplete = true;
            this.localPolygons.push(this.currentPolygon);
            this.isDrawing = false;
            this.currentPolygon = null;
            this.selectedPolygon = this.localPolygons[this.localPolygons.length - 1];
        } else {
            this.isDrawing = false;
            this.currentPolygon = null;
        }
        this.redrawPolygons();
    },

    handleMouseLeave() {
        this.redrawPolygons();
    },

    // --- Tool Logic ---
    handleIconClick(selectedIcon) {
      this.iconList.forEach(icon => (icon.active = icon.name === selectedIcon.name));
      this.selectedPolygon = null;
      this.isDrawing = false;
      this.currentPolygon = null;

      if (selectedIcon.name === 'fa-circle-minus') {
        if (confirm('Are you sure you want to delete all polygons on this slide?')) {
          this.localPolygons = this.localPolygons.filter(p => p.questionIndex !== this.questionIndex);
          this.redrawPolygons();
        }
        // De-select the clear all button after use
        this.iconList.find(icon => icon.name === 'fa-circle-minus').active = false;
        this.iconList.find(icon => icon.name === 'fa-draw-polygon').active = true;
      } else if (selectedIcon.name === 'fa-eraser' && this.selectedPolygon) {
          const index = this.localPolygons.indexOf(this.selectedPolygon);
          if (index > -1) {
              this.localPolygons.splice(index, 1);
              this.selectedPolygon = null;
          }
      }
      this.redrawPolygons();
    },

    // --- Coordinate and Geometry Helpers ---
    getMousePos(event) {
      const canvas = this.$refs.canvas;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },

    calculateImagePosition(canvasWidth, canvasHeight) {
      if (!this.originalWidth || !this.originalHeight) return { x: 0, y: 0, scale: 1 };
      const scale = Math.min(canvasWidth / this.originalWidth, canvasHeight / this.originalHeight);
      const x = (canvasWidth - this.originalWidth * scale) / 2;
      const y = (canvasHeight - this.originalHeight * scale) / 2;
      return { x, y, scale };
    },

    getCanvasCoordinates(originalPoint) {
        const canvas = this.$refs.canvas;
        if (!canvas) return originalPoint;
        const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
        return {
            x: originalPoint.x * scale + imgX,
            y: originalPoint.y * scale + imgY,
        };
    },

    getOriginalCoordinates(canvasPoint) {
        const canvas = this.$refs.canvas;
        if (!canvas) return canvasPoint;
        const { x: imgX, y: imgY, scale } = this.calculateImagePosition(canvas.width, canvas.height);
        return {
            x: (canvasPoint.x - imgX) / scale,
            y: (canvasPoint.y - imgY) / scale,
        };
    },
    
    getPointAt(mousePos) {
        for (const polygon of this.localPolygons) {
            for (const point of polygon.points) {
                const canvasP = this.getCanvasCoordinates(point);
                const distance = Math.hypot(canvasP.x - mousePos.x, canvasP.y - mousePos.y);
                if (distance < 6) { // 6px tolerance
                    return { polygon, point };
                }
            }
        }
        return null;
    },

    getPolygonAt(mousePos) {
        const ctx = this.$refs.canvas.getContext('2d');
        // Check in reverse order so top polygons are checked first
        for (let i = this.localPolygons.length - 1; i >= 0; i--) {
            const polygon = this.localPolygons[i];
            if (polygon.questionIndex !== this.questionIndex || !polygon.isComplete) continue;

            ctx.beginPath();
            const firstPoint = this.getCanvasCoordinates(polygon.points[0]);
            ctx.moveTo(firstPoint.x, firstPoint.y);
            for (let j = 1; j < polygon.points.length; j++) {
                const point = this.getCanvasCoordinates(polygon.points[j]);
                ctx.lineTo(point.x, point.y);
            }
            ctx.closePath();
            if (ctx.isPointInPath(mousePos.x, mousePos.y)) {
                return polygon;
            }
        }
        return null;
    },

    getClassColor(className, opacity) {
      const colors = {
        'Tumor': `rgba(255, 0, 0, ${opacity})`,   // Red
        'Stroma': `rgba(0, 255, 0, ${opacity})`,  // Green
        'Other': `rgba(0, 0, 255, ${opacity})`,   // Blue
      };
      return colors[className] || `rgba(255, 255, 0, ${opacity})`; // Default Yellow
    },

    // --- Component Actions ---
    commitChanges() {
      this.$emit("update:polygons", this.localPolygons);
      this.$emit("commitAssignmentChanges", 'polygon');
    },
  },

  mounted() {
    this.initialize();
    window.addEventListener("resize", this.resizeCanvas);
  },

  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCanvas);
  },

  watch: {
    src: {
      immediate: true,
      handler(newVal, oldVal) {
        if (newVal !== oldVal) {
          this.initialize();
        }
      },
    },
    polygons: {
        handler(newPolygons) {
            this.localPolygons = JSON.parse(JSON.stringify(newPolygons));
            this.redrawPolygons();
        },
        deep: true,
    }
  },
};
</script>

<style scoped>
.polygon-component {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 10px;
  background-color: #f0f0f0;
  min-height: 600px;
}

.polygon-component__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 5px;
  background-color: #fff;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.icon-list {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-list i {
  cursor: pointer;
  padding: 10px;
  font-size: 1.5em;
  transition: color 0.3s;
  position: relative;
}

.icon-explanation {
  visibility: hidden;
  background-color: black;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px 10px;
  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;
  width: max-content;
  font-size: 0.5em;
}

.icon-list i:hover .icon-explanation {
  visibility: visible;
  opacity: 1;
}

.icon-list i.active {
  color: var(--blue);
}

.icon-list i:hover {
  color: var(--blue-hover);
}

.polygon-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.component-actions button {
    padding: 8px 16px;
    border: none;
    background-color: var(--blue);
    color: white;
    border-radius: 4px;
    cursor: pointer;
}

.component-actions button:hover {
    background-color: var(--blue-hover);
}

.polygon-component__body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #000;
}

canvas {
  border: 1px solid #ccc;
  max-width: 100%;
  max-height: 100%;
}

.polygon-component__footer {
  padding: 5px;
  color: #fff;
  text-align: center;
  background-color: #333;
  margin-top: 10px;
  border-radius: 4px;
}
</style>
