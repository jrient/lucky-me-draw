<template>
  <div class="cloud-container" ref="container">
    <div class="cloud-wrapper">
      <div 
        v-for="(item, index) in items" 
        :key="item.id || item"
        class="cloud-item"
        :style="itemStyles[index]"
      >
        {{ item.name || item }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  speed: {
    type: Number,
    default: 1
  },
  isRunning: {
      type: Boolean,
      default: false
  }
});

const container = ref(null);
const itemStyles = shallowRef([]); // Use shallowRef for performance optimization on array updates
let basePoints = []; // Store initial spherical coordinates {x, y, z}
let animationFrameId = null;
let currentRotationY = 0;

// Configuration
const radius = 300; 

// Initialize points on a sphere (Fibonacci Sphere)
const initPoints = () => {
  const total = props.items.length;
  basePoints = [];
  itemStyles.value = new Array(total).fill({});

  for (let i = 0; i < total; i++) {
    const phi = Math.acos(-1 + (2 * i) / total);
    const theta = Math.sqrt(total * Math.PI) * phi;

    basePoints.push({
      x: radius * Math.cos(theta) * Math.sin(phi),
      y: radius * Math.sin(theta) * Math.sin(phi),
      z: radius * Math.cos(phi)
    });
  }
};

const updatePositions = () => {
  const sin = Math.sin(currentRotationY);
  const cos = Math.cos(currentRotationY);
  
  const newStyles = [];

  for (let i = 0; i < basePoints.length; i++) {
    const p = basePoints[i];
    
    // Rotate around Y axis
    // x' = x*cos - z*sin
    // z' = x*sin + z*cos
    const x = p.x * cos - p.z * sin;
    const z = p.x * sin + p.z * cos;
    // y remains unchanged in simple Y-axis rotation
    const y = p.y;

    // Scale and Opacity based on Z (depth)
    // z ranges from -radius to +radius
    // We want scale 0.6 to 1.2, opacity 0.3 to 1
    const scale = (z + radius) / (2 * radius); // 0 to 1
    const finalScale = 0.6 + (scale * 0.6); // 0.6 to 1.2
    const opacity = 0.2 + (scale * 0.8);    // 0.2 to 1.0
    const zIndex = Math.floor(z); // Ensure front items cover back items

    newStyles[i] = {
      transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${finalScale})`,
      opacity: opacity,
      zIndex: zIndex
    };
  }
  
  itemStyles.value = newStyles;
};

const animate = () => {
    // Determine speed
    let step = 0.002; // Base slow speed
    if (props.isRunning) {
        step = 0.05; // Fast spin
    } else if (props.speed > 1) {
        step = 0.002 * props.speed;
    }

    currentRotationY += step;
    updatePositions();
    
    animationFrameId = requestAnimationFrame(animate);
};

// Re-init when items change
watch(() => props.items, () => {
  initPoints();
});

onMounted(() => {
  initPoints();
  animate();
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId);
});

</script>

<style scoped>
.cloud-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  /* Perspective gives depth to the translate3d z-axis */
  perspective: 1000px; 
}

.cloud-wrapper {
  position: relative;
  width: 0;
  height: 0;
  /* No transform-style: preserve-3d needed here necessarily if we don't rotate wrapper, 
     but helpful for z-index sorting context */
  transform-style: preserve-3d;
}

.cloud-item {
  position: absolute;
  left: 50%;
  top: 50%;
  /* Center the element itself */
  width: 120px;
  height: 40px;
  margin-left: -60px;
  margin-top: -20px;
  
  display: flex;
  justify-content: center;
  align-items: center;
  
  font-size: 18px;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 5px rgba(255, 0, 0, 0.8);
  white-space: nowrap;
  
  /* Critical: Hardware acceleration for smoother movement */
  will-change: transform, opacity; 
}
</style>