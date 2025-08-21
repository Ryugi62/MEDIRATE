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

      <div class="tool-selector">
        <span class="tool-label">모드:</span>
        <button class="tool-btn" :class="{ active: mode==='draw' }" @click="setMode('draw')">✏️ 그리기</button>
        <button class="tool-btn" :class="{ active: mode==='add' }" @click="setMode('add')">➕ 추가</button>
        <button class="tool-btn" :class="{ active: mode==='subtract' }" @click="setMode('subtract')">➖ 삭제</button>
        <span class="tool-sep"></span>
        <span class="tool-label">도형:</span>
        <button class="shape-btn" :class="{ active: shape==='freehand' }" @click="setShape('freehand')" title="자유">✏️</button>
        <button class="shape-btn" :class="{ active: shape==='circle' }" @click="setShape('circle')" title="원">⭕</button>
        <button class="shape-btn" :class="{ active: shape==='rectangle' }" @click="setShape('rectangle')" title="사각">⬜</button>
        <button class="shape-btn" :class="{ active: shape==='triangle' }" @click="setShape('triangle')" title="삼각">🔺</button>
      </div>

      <div class="polygon-actions">
        <span v-for="c in availableClasses" :key="c" class="radio-group">
          <input type="radio" :id="`class-${c}`" :value="c" v-model="currentClass" @change="updateSelectedPolygonClass">
          <label :for="`class-${c}`" :style="{ color: getClassColor(c, 1), fontWeight: 'bold' }">{{ c }}</label>
        </span>
      </div>

      <div class="component-actions">
        <button class="secondary" @click="undo">Undo</button>
        <button @click="commitChanges">Save</button>
        <label class="toggle-points">
          <input type="checkbox" v-model="showPoints" /> 점 표시
        </label>
      </div>
    </div>

    <div class="main-content-wrapper">
      <div class="polygon-component__body">
        <canvas
          ref="canvas"
          :class="{ 'add-tool-active': addToolActive }"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseLeave"
          @contextmenu.prevent="handleRightClick"
        ></canvas>
      </div>
      <div class="polygon-list-sidebar">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, index) in localPolygons.filter(p => p.questionIndex === questionIndex)" :key="p.id" @click="selectPolygonFromList(p)" :class="{ 'selected-row': p === selectedPolygon }">
              <td>{{ index + 1 }}</td>
              <td>{{ p.class }}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
  currentPath: [],
  startPoint: null,
  lastMousePos: null,
      selectedPolygon: null,
      hoveredPoint: null,
      isDraggingPoint: false,
      
      availableClasses: ['Tumor', 'Stroma', 'Other'],
      currentClass: 'Tumor', // Default class

  // Tools
  mode: 'draw', // 'draw' | 'add' | 'subtract'
  shape: 'freehand', // 'freehand' | 'circle' | 'rectangle' | 'triangle'
  history: [],
  // 표시 설정: 정점 점(버텍스 점) 표시 여부
  showPoints: false,
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
  this.saveState();
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

  const allPolygons = [...this.localPolygons, this.currentPolygon]
        .filter(p => p && Array.isArray(p.points) && p.points.length > 0);

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
        
        // Draw points (옵션)
        if (this.showPoints) {
          polygon.points.forEach(p => {
              const canvasP = this.getCanvasCoordinates(p);
              ctx.beginPath();
              ctx.arc(canvasP.x, canvasP.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = 'white';
              ctx.fill();
              ctx.strokeStyle = 'black';
              ctx.stroke();
          });
        }
      });

      // Live preview while drawing
      if (this.isDrawing) {
        const ctx2 = this.$refs.canvas.getContext('2d');
        ctx2.save();
        ctx2.setLineDash([5, 5]);
        ctx2.strokeStyle = 'rgba(255,0,0,0.8)';
        ctx2.lineWidth = 2;
        if (this.shape === 'freehand' && this.currentPath.length > 1) {
          const pts = this.currentPath.map(p => this.getCanvasCoordinates(p));
          ctx2.beginPath();
          ctx2.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx2.lineTo(pts[i].x, pts[i].y);
          ctx2.stroke();
        } else if (this.startPoint && this.lastMousePos) {
          const preview = this.generateShapePath(this.startPoint, this.getOriginalCoordinates(this.lastMousePos));
          if (preview && preview.length) {
            const pts = preview.map(p => this.getCanvasCoordinates(p));
            ctx2.beginPath();
            ctx2.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx2.lineTo(pts[i].x, pts[i].y);
            ctx2.closePath();
            ctx2.stroke();
          }
        }
        ctx2.restore();
      }
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
      this.lastMousePos = mousePos;
      const originalPos = this.clampToImage(this.getOriginalCoordinates(mousePos));

      // Drag existing point (only in draw mode when not currently drawing)
      if (!this.isDrawing && this.mode === 'draw') {
        const pointInfo = this.getPointAt(mousePos);
        if (pointInfo) {
          this.isDraggingPoint = true;
          this.selectedPolygon = pointInfo.polygon;
          this.hoveredPoint = pointInfo.point;
          return;
        }
      }

      // Start drawing
      this.isDrawing = true;
      this.startPoint = originalPos;
      this.currentPath = this.shape === 'freehand' ? [originalPos] : [];
      this.currentPolygon = {
        id: Date.now(),
        points: this.shape === 'freehand' ? [originalPos] : [],
        class: this.currentClass,
        isComplete: false,
        questionIndex: this.questionIndex,
      };
      this.redrawPolygons();
  this.startGlobalMouseTracking();
    },

    handleMouseMove(event) {
      const mousePos = this.getMousePos(event);
      this.lastMousePos = mousePos;
      if (this.isDrawing) {
        if (this.shape === 'freehand') {
          const originalPos = this.clampToImage(this.getOriginalCoordinates(mousePos));
          const last = this.currentPath[this.currentPath.length - 1];
          if (!last) {
            this.currentPath.push(originalPos);
          } else {
            const dx = originalPos.x - last.x;
            const dy = originalPos.y - last.y;
            // 2px 이상 이동했을 때만 포인트 추가 (노이즈/무거움 방지)
            if ((dx * dx + dy * dy) > 4) {
              this.currentPath.push(originalPos);
            }
          }
          this.currentPolygon.points = this.currentPath;
        }
        this.redrawPolygons();
      } else if (this.isDraggingPoint && this.hoveredPoint) {
        const originalPos = this.clampToImage(this.getOriginalCoordinates(mousePos));
        this.hoveredPoint.x = originalPos.x;
        this.hoveredPoint.y = originalPos.y;
        this.redrawPolygons();
      }
    },
    
    handleMouseUp(event) {
      if (event.button !== 0) return;
      if (this.isDrawing) {
        const endOriginal = this.clampToImage(this.getOriginalCoordinates(this.getMousePos(event)));
        this.finalizePath(endOriginal);
      }
      this.isDraggingPoint = false;
      this.hoveredPoint = null;
  this.stopGlobalMouseTracking();
    },

    handleRightClick() {
      this.isDrawing = false;
      this.currentPolygon = null;
      this.currentPath = [];
      this.startPoint = null;
      this.redrawPolygons();
  this.stopGlobalMouseTracking();
    },

    handleMouseLeave() {
        this.redrawPolygons();
    },

    // --- Tool Logic ---
    setMode(mode) {
      this.mode = mode;
      this.isDrawing = false;
      this.currentPolygon = null;
      this.currentPath = [];
    },

    setShape(shape) {
      this.shape = shape;
      this.isDrawing = false;
      this.currentPolygon = null;
      this.currentPath = [];
    },

    handleKeyDown(e) {
      if (e.shiftKey && this.mode !== 'add') {
        this.setMode('add');
      } else if ((e.ctrlKey || e.metaKey) && this.mode !== 'subtract') {
        this.setMode('subtract');
      }
    },

    handleKeyUp(e) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey && this.mode !== 'draw') {
        this.setMode('draw');
      }
    },
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

    undo() {
      if (this.history.length > 1) {
        this.history.pop();
        this.localPolygons = JSON.parse(JSON.stringify(this.history[this.history.length - 1]));
        this.redrawPolygons();
      }
    },

    updateSelectedPolygonClass() {
      if (this.selectedPolygon) {
        this.selectedPolygon.class = this.currentClass;
        this.redrawPolygons();
      }
    },

    selectPolygonFromList(polygon) {
      this.selectedPolygon = polygon;
      this.currentClass = polygon.class;
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

    clampToImage(p) {
      if (this.originalWidth && this.originalHeight) {
        return {
          x: Math.max(0, Math.min(p.x, this.originalWidth)),
          y: Math.max(0, Math.min(p.y, this.originalHeight)),
        };
      }
      return p;
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

    // --- Freehand/Shape helpers ---
    generateShapePath(start, end) {
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      switch (this.shape) {
        case 'circle':
          return this.generateCircle(centerX, centerY, Math.max(width, height) / 2);
        case 'rectangle':
          return this.generateRectangle(start.x, start.y, end.x, end.y);
        case 'triangle':
          return this.generateTriangle(start.x, start.y, end.x, end.y);
        default:
          return [];
      }
    },

    generateCircle(centerX, centerY, radius) {
      const points = [];
      const segments = 32;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
      }
      return points;
    },

    generateRectangle(x1, y1, x2, y2) {
      return [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ];
    },

    generateTriangle(x1, y1, x2, y2) {
      const centerX = (x1 + x2) / 2;
      return [
        { x: centerX, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ];
    },

    simplifyPath(path, tolerance = 3) {
      if (!path || path.length <= 2) return path || [];
      const simplified = [path[0]];
      let lastIndex = 0;
      for (let i = 1; i < path.length; i++) {
        const d = Math.hypot(path[i].x - path[lastIndex].x, path[i].y - path[lastIndex].y);
        if (d > tolerance || i === path.length - 1) {
          simplified.push(path[i]);
          lastIndex = i;
        }
      }
      return simplified;
    },

    finalizePath(endOriginal) {
      let finalPath = [];
      if (this.shape === 'freehand') {
        finalPath = this.simplifyPath(this.currentPath, 3);
      } else {
        finalPath = this.generateShapePath(this.startPoint, endOriginal);
      }
      if (!finalPath || finalPath.length < 3) {
        this.isDrawing = false;
        this.currentPath = [];
        this.currentPolygon = null;
        this.startPoint = null;
        this.redrawPolygons();
        return;
      }

      if (this.mode === 'draw') {
        this.addNewPolygon(finalPath);
      } else if (this.mode === 'add') {
        this.addAreaToExisting(finalPath);
      } else if (this.mode === 'subtract') {
        this.subtractAreaFromExisting(finalPath);
      }

  // Reset transient drawing state to stop preview following the cursor
  this.isDrawing = false;
  this.currentPath = [];
  this.currentPolygon = null;
  this.startPoint = null;
  this.lastMousePos = null;
  this.stopGlobalMouseTracking();
  this.redrawPolygons();
    },

    addNewPolygon(points) {
      const polygon = {
        id: Date.now(),
        points,
        class: this.currentClass,
        isComplete: true,
        questionIndex: this.questionIndex,
      };
      polygon.area = this.calculateArea(points);
      this.localPolygons.push(polygon);
      this.selectedPolygon = polygon;
      this.saveState();
    },

    addAreaToExisting(newPoints) {
      const targetIndex = this.findNearestPolygon(newPoints);
      if (targetIndex >= 0) {
        const target = this.localPolygons[targetIndex];
        const combined = this.combinePolygons(target.points, newPoints);
        if (combined && combined.length >= 3) {
          target.points = combined;
          target.area = this.calculateArea(combined);
          this.saveState();
        }
      } else {
        this.addNewPolygon(newPoints);
      }
    },

    subtractAreaFromExisting(subtractPoints) {
      let modified = false;
      for (let i = this.localPolygons.length - 1; i >= 0; i--) {
        const poly = this.localPolygons[i];
        if (poly.questionIndex !== this.questionIndex) continue;
        if (this.polygonsOverlap(poly.points, subtractPoints)) {
          const result = this.subtractFromPolygon(poly.points, subtractPoints);
          if (!result || result.length < 3) {
            this.localPolygons.splice(i, 1);
            modified = true;
          } else {
            poly.points = result;
            poly.area = this.calculateArea(result);
            modified = true;
          }
        }
      }
      if (modified) this.saveState();
    },

    saveState() {
      this.history.push(JSON.parse(JSON.stringify(this.localPolygons)));
      if (this.history.length > 30) this.history.shift();
  // 부모(v-model:polygons)로 즉시 반영해 리스트/다른 뷰와 동기화
  this.$emit("update:polygons", this.localPolygons);
    },

    // Geometry helpers
    findNearestPolygon(points) {
      let nearestIndex = -1;
      let maxOverlap = 0;
      for (let i = 0; i < this.localPolygons.length; i++) {
        const p = this.localPolygons[i];
        if (p.questionIndex !== this.questionIndex) continue;
        const overlap = this.calculateOverlapScore(p.points, points);
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          nearestIndex = i;
        }
      }
      return nearestIndex;
    },

    calculateOverlapScore(poly1, poly2) {
      let count = 0;
      poly1.forEach(pt => { if (this.isPointInPolygon(pt, poly2)) count++; });
      poly2.forEach(pt => { if (this.isPointInPolygon(pt, poly1)) count++; });
      return count;
    },

    polygonsOverlap(poly1, poly2) {
      for (const pt of poly1) if (this.isPointInPolygon(pt, poly2)) return true;
      for (const pt of poly2) if (this.isPointInPolygon(pt, poly1)) return true;
      return false;
    },

    combinePolygons(poly1, poly2) {
      const all = [...poly1, ...poly2];
      return this.convexHull(all);
    },

    subtractFromPolygon(poly1, poly2) {
      return poly1.filter(pt => !this.isPointInPolygon(pt, poly2));
    },

    convexHull(points) {
      if (!points || points.length < 3) return points || [];
      const unique = points.filter((p, idx, arr) => idx === arr.findIndex(q => Math.abs(q.x - p.x) < 2 && Math.abs(q.y - p.y) < 2));
      if (unique.length < 3) return unique;
      let start = unique[0];
      for (const p of unique) if (p.y < start.y || (p.y === start.y && p.x < start.x)) start = p;
      const sorted = unique.filter(p => p !== start).sort((a, b) => {
        const A = Math.atan2(a.y - start.y, a.x - start.x);
        const B = Math.atan2(b.y - start.y, b.x - start.x);
        return A - B;
      });
      const hull = [start];
      for (const p of sorted) {
        while (hull.length > 1 && this.crossProduct(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
        hull.push(p);
      }
      return hull;
    },

    crossProduct(o, a, b) {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    },

    isPointInPolygon(point, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
            (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
          inside = !inside;
        }
      }
      return inside;
    },

    calculateArea(points) {
      if (!points || points.length < 3) return 0;
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y - points[j].x * points[i].y;
      }
      return Math.abs(area / 2);
    },
    
    recalculatePolygonArea(polygon) {
      if (polygon && polygon.points) polygon.area = this.calculateArea(polygon.points);
    },

    // --- Component Actions ---
    commitChanges() {
      this.$emit("update:polygons", this.localPolygons);
      this.$emit("commitAssignmentChanges", 'polygon');
    },

    // --- Global mouse tracking to end drawing outside the canvas ---
    startGlobalMouseTracking() {
      if (!this._globalMouseMove) {
        this._globalMouseMove = (e) => this.handleMouseMove(e);
        this._globalMouseUp = (e) => this.handleMouseUp(e);
        window.addEventListener('mousemove', this._globalMouseMove);
        window.addEventListener('mouseup', this._globalMouseUp);
      }
    },
    stopGlobalMouseTracking() {
      if (this._globalMouseMove) {
        window.removeEventListener('mousemove', this._globalMouseMove);
        window.removeEventListener('mouseup', this._globalMouseUp);
        this._globalMouseMove = null;
        this._globalMouseUp = null;
      }
    },
  },

  mounted() {
  this.initialize();
  window.addEventListener("resize", this.resizeCanvas);
  window.addEventListener('keydown', this.handleKeyDown);
  window.addEventListener('keyup', this.handleKeyUp);
  },

  beforeUnmount() {
  window.removeEventListener("resize", this.resizeCanvas);
  window.removeEventListener('keydown', this.handleKeyDown);
  window.removeEventListener('keyup', this.handleKeyUp);
  this.stopGlobalMouseTracking();
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

.tool-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-label {
  font-weight: bold;
}
.tool-btn, .shape-btn {
  padding: 6px 10px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}
.tool-btn.active, .shape-btn.active {
  background: var(--blue);
  color: #fff;
  border-color: var(--blue);
}
.tool-sep { width: 1px; height: 20px; background: #ddd; display: inline-block; margin: 0 6px; }

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

.toggle-points {
  margin-left: 8px;
  color: #333;
  user-select: none;
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

.radio-group {
  display: flex;
  align-items: center;
  margin-right: 15px;
}

.radio-group label {
  cursor: pointer;
  margin-left: 5px;
}

.main-content-wrapper {
  display: flex;
  flex: 1;
  gap: 10px;
  min-height: 0; /* Fix for flexbox overflow */
}

.polygon-list-sidebar {
  width: 200px;
  border: 1px solid #ccc;
  background-color: #fff;
  overflow-y: auto;
}

.polygon-list-sidebar table {
  width: 100%;
  border-collapse: collapse;
}

.polygon-list-sidebar th, .polygon-list-sidebar td {
  border-bottom: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.polygon-list-sidebar tbody tr {
  cursor: pointer;
}

.polygon-list-sidebar tbody tr:hover {
  background-color: #f0f0f0;
}

.polygon-list-sidebar tbody tr.selected-row {
  background-color: var(--blue-active);
  color: white;
}

canvas.add-tool-active {
  cursor: crosshair;
}
</style>
