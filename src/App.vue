<template>
  <div class="main-layout">
    <!-- Header -->
    <header class="header">
      <h1 class="title">{{ settings.title }}</h1>
      <div class="prize-info" v-if="currentPrize">
        <div class="prize-name">{{ currentPrize.name }}</div>
        <div class="prize-count">
          本轮抽取: {{ currentPrize.count }} 人 
          <span class="small">(剩余库存: {{ remainingSlots }})</span>
        </div>
      </div>
    </header>

    <!-- Main Content: Word Cloud or Winner Display -->
    <main class="content">
      <!-- 3D Name Cloud -->
      <div v-show="!showResult" class="cloud-box">
        <WordCloud 
          :items="eligibleCandidates" 
          :isRunning="isRunning"
        />
      </div>

      <!-- Winner Overlay / Result View -->
      <div v-if="showResult" class="result-box">
        <div class="result-title">🎉 中奖名单 🎉</div>
        <div class="result-list">
          <div 
            v-for="winner in currentBatchWinners" 
            :key="winner" 
            class="winner-card"
          >
            {{ winner }}
          </div>
        </div>
      </div>
    </main>

    <!-- Footer Controls -->
    <footer class="controls">
      <div class="left-controls">
        <button class="btn nav-btn" @click="prevPrize" :disabled="isRunning || prizeIndex <= 0">
          &lt; 上一项
        </button>
        <button class="btn nav-btn" @click="nextPrize" :disabled="isRunning || prizeIndex >= settings.prizes.length - 1">
           下一项 &gt;
        </button>
      </div>

      <div class="center-controls">
        <button 
          v-if="!showResult"
          class="btn action-btn" 
          :class="{ 'stop-btn': isRunning }"
          @click="toggleRun"
          :disabled="remainingSlots <= 0 && !isRunning"
        >
          {{ isRunning ? '停 止' : '开始抽奖' }}
        </button>
        <button v-else class="btn action-btn" @click="closeResult">
          继续抽奖
        </button>
      </div>

      <div class="right-controls">
        <button class="btn text-btn" @click="toggleWinnerList">
          {{ showAllWinners ? '关闭名单' : '获奖名单' }}
        </button>
      </div>
    </footer>

    <!-- All Winners Sidebar -->
    <div class="sidebar" :class="{ open: showAllWinners }">
      <div class="sidebar-header">
        <h2>🏆 荣誉榜</h2>
        <button class="btn reset-btn" @click="resetData">重置所有</button>
      </div>
      <div v-for="prize in settings.prizes" :key="prize.id" class="sidebar-section">
        <h3>{{ prize.name }}</h3>
        <div class="sidebar-names">
          <span v-for="name in (winners[prize.id] || [])" :key="name" class="tag">
            {{ name }}
          </span>
          <span v-if="!(winners[prize.id] || []).length" class="empty">暂无</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import WordCloud from './components/WordCloud.vue';

// State
const settings = ref({ title: '加载中...', prizes: [] });
const groups = ref({});
const winners = ref({});
const prizeIndex = ref(0);
const isRunning = ref(false);
const showResult = ref(false);
const showAllWinners = ref(false);
const currentBatchWinners = ref([]);

// Computed
const currentPrize = computed(() => {
  if (!settings.value.prizes.length) return null;
  return settings.value.prizes[prizeIndex.value];
});

// All winners flattened to check for duplicates globally
const allWinnerNames = computed(() => {
  let names = new Set();
  Object.values(winners.value).forEach(list => {
    list.forEach(name => names.add(name));
  });
  return names;
});

// Candidates for the CURRENT prize
const eligibleCandidates = computed(() => {
  if (!currentPrize.value) return [];
  
  // 1. Get groups for this prize
  const targetGroups = currentPrize.value.groups || [];
  
  // 2. Collect all names from these groups
  let pool = [];
  targetGroups.forEach(gKey => {
    if (groups.value[gKey]) {
      pool = pool.concat(groups.value[gKey]);
    }
  });

  // 3. Filter out existing winners
  return pool.filter(name => !allWinnerNames.value.has(name));
});

const remainingSlots = computed(() => {
    if (!currentPrize.value) return 0;
    const currentWinners = winners.value[currentPrize.value.id] || [];
    // If the requirement is "Total count", then remaining = total - current.
    // Assuming 'count' in json is TOTAL slots for that prize.
    return Math.max(0, currentPrize.value.count - currentWinners.length);
});

// Methods
const loadData = async () => {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    settings.value = data.settings;
    groups.value = data.groups;
    winners.value = data.winners || {};
    // Ensure winners object has keys for all prizes
    settings.value.prizes.forEach(p => {
        if (!winners.value[p.id]) winners.value[p.id] = [];
    });
    // Set to last prize (First Prize usually at end? No, usually Start with lowest)
    // Let's start at 0 (3rd prize in user json)
    prizeIndex.value = 0;
  } catch (e) {
    console.error("Failed to load data", e);
    alert("数据加载失败，请确保后台已启动");
  }
};

const saveData = async () => {
    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(winners.value)
        });
    } catch (e) {
        console.error("Failed to save", e);
    }
};

const prevPrize = () => {
  if (prizeIndex.value > 0) prizeIndex.value--;
};

const nextPrize = () => {
  if (prizeIndex.value < settings.value.prizes.length - 1) prizeIndex.value++;
};

const toggleRun = () => {
  if (isRunning.value) {
    stopLottery();
  } else {
    startLottery();
  }
};

const startLottery = () => {
  if (remainingSlots.value <= 0) {
      alert("该奖项名额已满！");
      return;
  }
  if (eligibleCandidates.value.length === 0) {
      alert("没有符合条件的人员可供抽奖！");
      return;
  }
  isRunning.value = true;
};

const stopLottery = () => {
  isRunning.value = false;
  
  // Logic to pick winners
  const countToDraw = Math.min(remainingSlots.value, eligibleCandidates.value.length);
  // If we want to draw ALL remaining slots at once? Yes, user said "Simple".
  // Or maybe just 1? The requirement says "count: 10". Usually drawing 10 at once is too crowded?
  // User said "No supplementary mechanism", implying one click finishes the batch or fills it.
  // Let's draw ALL needed to fill the count, or if the list is huge, maybe limit to 5 per screen?
  // Requirement: "3D scrolling blinking everyone... show winner list".
  // Let's draw ALL remaining slots for this prize.
  
  const pool = [...eligibleCandidates.value];
  const drawn = [];
  
  for (let i = 0; i < countToDraw; i++) {
      if (pool.length === 0) break;
      const randomIndex = Math.floor(Math.random() * pool.length);
      drawn.push(pool[randomIndex]);
      pool.splice(randomIndex, 1); // Remove to avoid double pick in same batch
  }

  // Update State
  const pid = currentPrize.value.id;
  if (!winners.value[pid]) winners.value[pid] = [];
  winners.value[pid] = [...winners.value[pid], ...drawn];
  
  currentBatchWinners.value = drawn;
  showResult.value = true;
  
  saveData();
};

const closeResult = () => {
    showResult.value = false;
    currentBatchWinners.value = [];
};

const toggleWinnerList = () => {
    showAllWinners.value = !showAllWinners.value;
};

const resetData = async () => {
  if (!confirm('⚠️ 确定要清空所有中奖记录吗？\n\n此操作不可恢复！所有已中奖人员将重回抽奖池。')) {
    return;
  }
  
  // Clear all winners
  winners.value = {};
  settings.value.prizes.forEach(p => {
      winners.value[p.id] = [];
  });
  
  await saveData();
  // Close the sidebar to show the refreshed state/cloud potentially
  alert('数据已重置，所有人已回到抽奖池。');
};

// Keyboard shortcut
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        // Prevent default scrolling
        e.preventDefault(); 
        if (!showResult.value && !showAllWinners.value) {
             toggleRun();
        } else if (showResult.value) {
            closeResult();
        }
    }
});

onMounted(() => {
  loadData();
});

</script>

<style>
/* Layout */
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  z-index: 1;
}

/* Header */
.header {
  text-align: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
}
.title {
  margin: 0;
  font-size: 2.5rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  color: var(--gold-color);
}
.prize-info {
  margin-top: 10px;
}
.prize-name {
  font-size: 3rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10px #ff0000;
}
.prize-count {
  font-size: 1.2rem;
  opacity: 0.8;
}

/* Content */
.content {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
.cloud-box {
  width: 100%;
  height: 100%;
}

/* Controls */
.controls {
  height: 80px;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
}
.btn {
  border: none;
  cursor: pointer;
  padding: 10px 20px;
  border-radius: 5px;
  font-size: 1rem;
  transition: all 0.2s;
  font-family: inherit;
}
.nav-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}
.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn {
  background: var(--gold-color);
  color: #b31217;
  font-size: 1.5rem;
  font-weight: bold;
  padding: 10px 60px;
  box-shadow: 0 4px 0 #b8860b;
}
.action-btn:active {
  transform: translateY(4px);
  box-shadow: none;
}
.stop-btn {
    background: #ff4d4d;
    color: white;
    box-shadow: 0 4px 0 #8b0000;
}

.text-btn {
    background: transparent;
    color: rgba(255,255,255,0.7);
    text-decoration: underline;
}

/* Sidebar */
.sidebar {
  position: fixed;
  right: -400px;
  top: 0;
  width: 350px;
  height: 100vh;
  background: rgba(50, 0, 0, 0.95);
  box-shadow: -5px 0 15px rgba(0,0,0,0.5);
  transition: right 0.3s ease;
  z-index: 100;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
}
.sidebar.open {
  right: 0;
}
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,215,0,0.3);
  padding-bottom: 10px;
  margin-bottom: 20px;
}
.sidebar h2 {
    color: var(--gold-color);
    margin: 0;
    padding: 0;
    border: none;
}
.reset-btn {
  background: transparent;
  border: 1px solid #ff4d4d;
  color: #ff4d4d;
  font-size: 0.8rem;
  padding: 5px 10px;
}
.reset-btn:hover {
  background: #ff4d4d;
  color: white;
}
.sidebar-section {
    margin-bottom: 20px;
}
.sidebar-names {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.tag {
    background: rgba(255,255,255,0.1);
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 0.9rem;
}

/* Result Overlay */
.result-box {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 50;
  width: 80%;
}
.result-title {
    font-size: 3rem;
    color: var(--gold-color);
    margin-bottom: 30px;
    text-shadow: 0 4px 10px rgba(0,0,0,0.5);
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.result-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
}
.winner-card {
    background: linear-gradient(135deg, #ffd700, #ffa500);
    color: #b31217;
    font-size: 2.5rem;
    font-weight: bold;
    padding: 20px 40px;
    border-radius: 10px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    min-width: 150px;
    animation: flipIn 0.6s ease-out backwards;
}

/* Animations */
@keyframes popIn {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
@keyframes flipIn {
    from { transform: rotateX(90deg); opacity: 0; }
    to { transform: rotateX(0); opacity: 1; }
}
</style>