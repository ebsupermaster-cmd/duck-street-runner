// Duck Street Dash - Endless Runner
// SECTION: Core game setup
/* global THREE */
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('Three.js failed to load. 3D view disabled, but UI still works.');
  }

  // SECTION: DOM references
  const canvas = document.getElementById('gameCanvas');
  const startButton = document.getElementById('startButton');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const scoreValue = document.getElementById('scoreValue');
  const bestValue = document.getElementById('bestValue');
  const difficultyValue = document.getElementById('difficultyValue');
  const statusCopy = document.getElementById('statusCopy');
  const speedDot = document.getElementById('speedDot');
  const helpToggle = document.getElementById('helpToggle');
  const helpPanel = document.getElementById('helpPanel');

  const touchLeft = document.getElementById('touchLeft');
  const touchRight = document.getElementById('touchRight');
  const touchJump = document.getElementById('touchJump');
  const easyButton = document.getElementById('easyButton');
  const hardButton = document.getElementById('hardButton');

  let currentLevel =1; // 1: classic, 2: with trees and shields

  // SECTION: Game state
  const LANES = [-1.5, 0, 1.5];
  const DUCK_Y_IDLE = 0.4;
  let DUCK_JUMP_HEIGHT = 2.4;
  let JUMP_DURATION = 1.0; // seconds
  const BASE_JUMP_HEIGHT = 2.0;
  const BASE_JUMP_DURATION = 1.0;
  
  let isEasyMode = true; // difficulty toggle

  let scene, camera, renderer;
  let roadGroup, waterGroup, carGroup, treeGroup;
  let duck;

  // power-up / hazard state
  let isShielded = false;
  let shieldTime = 0;
  const SHIELD_DURATION = 6; // seconds

  let gameRunning = false;
  let gameOver = false;
  let score = 0;
  let bestScore = Number(localStorage.getItem('duckDashBest') || 0);
  let baseSpeed = 5; // units per second (reduced for easier play)
  let speed = baseSpeed;
  let laneIndex = 1; // middle lane
  let jumpTime = 0;
  let isJumping = false;
  let lastTime = null;

  bestValue.textContent = bestScore;

  // SECTION: 3D Scene setup
  function init3D() {
    if (!canvas || typeof THREE === 'undefined') return;

    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 340;

    scene = new THREE.Scene();
    // background color will be set per-level in buildTrack
    scene.background = new THREE.Color(0x020617);

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 6.5);
    camera.lookAt(0, 0.8, -4);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(4, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    scene.add(dirLight);

    // Groups
    roadGroup = new THREE.Group();
    waterGroup = new THREE.Group();
    carGroup = new THREE.Group();
    treeGroup = new THREE.Group();
    scene.add(roadGroup, waterGroup, carGroup, treeGroup);

    // Ground base
    const groundGeo = new THREE.PlaneGeometry(40, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -20;
    ground.receiveShadow = true;
    scene.add(ground);

    // Streets & water segments
    buildTrack();

    // Duck
    duck = buildDuck();
    duck.position.set(LANES[laneIndex], DUCK_Y_IDLE, 0);
    scene.add(duck);

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!renderer || !camera || !canvas) return;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || 320;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  // SECTION: World building
  function buildTree(trunkMat, leavesMat) {
    const group = new THREE.Group();

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 6), trunkMat);
    trunk.position.y = 0.35;
    trunk.castShadow = true;
    group.add(trunk);

    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), leavesMat);
    foliage.position.y = 1.1;
    foliage.castShadow = true;
    group.add(foliage);

    group.castShadow = true;
    group.receiveShadow = true;

    return group;
  }

  function buildDuck() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.1 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf97316 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x020617 });

    // body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.1), bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.set(0, 0.85, 0.1);
    head.castShadow = true;
    group.add(head);

    // beak
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.38), beakMat);
    beak.position.set(0, 0.72, 0.45);
    beak.castShadow = true;
    group.add(beak);

    // eyes
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 0.93, 0.34);
    eyeR.position.set(0.16, 0.93, 0.34);
    group.add(eyeL, eyeR);

    // tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.4), bodyMat);
    tail.position.set(0, 0.55, -0.7);
    tail.rotation.x = -0.4;
    group.add(tail);

    group.castShadow = true;
    group.receiveShadow = true;

    return group;
  }

  function buildTrack() {
    const isLevel2 = currentLevel === 2;

    roadGroup.clear();
    waterGroup.clear();
    carGroup.clear();
    if (treeGroup) treeGroup.clear();

    // set sky/ground tint per level
    if (scene) {
      scene.background = new THREE.Color(isLevel2 ? 0x60a5fa : 0x020617);
    }

    const roadMat = new THREE.MeshStandardMaterial({ color: isLevel2 ? 0x111827 : 0x1f2937 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf9fafb, emissive: 0xf9fafb, emissiveIntensity: 0.4 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.7, roughness: isLevel2 ? 0.15 : 0.25 });

    const segmentLength = 3.5;
    const visibleAhead = 18;

    // simple low-poly trees along the sides (level 2+ only)
    const treeMatTrunk = isLevel2 ? new THREE.MeshStandardMaterial({ color: 0x78350f }) : null;
    const treeMatLeaves = isLevel2 ? new THREE.MeshStandardMaterial({ color: 0x16a34a }) : null;

    // occasional shield power-ups (level 2 only)
    const powerupMat = isLevel2
      ? new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.7 })
      : null;

    for (let i = 0; i < visibleAhead; i++) {
      const zPos = -i * segmentLength;

      // Alternate road and water every few segments
      const isWaterGap = (i + 4) % 7 === 0;

      if (!isWaterGap) {
        const road = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, segmentLength), roadMat);
        road.position.set(0, 0, zPos);
        road.receiveShadow = true;
        roadGroup.add(road);

        // roadside trees (level 2 only)
        if (isLevel2 && Math.random() < 0.55 && treeMatTrunk && treeMatLeaves) {
          const treeLeft = buildTree(treeMatTrunk, treeMatLeaves);
          treeLeft.position.set(-3.8 - Math.random() * 1.2, 0, zPos + (Math.random() - 0.5));
          treeGroup.add(treeLeft);

          const treeRight = buildTree(treeMatTrunk, treeMatLeaves);
          treeRight.position.set(3.8 + Math.random() * 1.2, 0, zPos + (Math.random() - 0.5));
          treeGroup.add(treeRight);
        }

        // lane separators
        for (let n = -1; n <= 1; n++) {
          if (n === 0) continue;
          const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, segmentLength * 0.7), lineMat);
          line.position.set(LANES[n + 1], 0.11, zPos);
          roadGroup.add(line);
        }

        // occasional shield power-up hovering above lane (level 2 only)
        if (isLevel2 && powerupMat && i > 4 && Math.random() < 0.12) {
          const laneIndexPower = Math.floor(Math.random() * LANES.length);
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), powerupMat);
          orb.position.set(LANES[laneIndexPower], 1.4, zPos - 4 - Math.random() * 4);
          orb.userData.type = 'shield';
          roadGroup.add(orb);
        }

        // occasional cars
        if (i > 3 && Math.random() < 0.25) {
          const laneIndex = Math.floor(Math.random() * LANES.length);
          const car = buildCar();
          car.position.set(LANES[laneIndex], 0.35, zPos - 6 - Math.random() * 10);
          car.userData.speed = baseSpeed * 0.9 + Math.random() * 1.5;
          carGroup.add(car);
        }
      } else {
        const water = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, segmentLength * 0.7), waterMat);
        water.position.set(0, -0.02, zPos);
        water.receiveShadow = true;
        waterGroup.add(water);
      }
    }
  }

  function buildCar() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.4 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.6, roughness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x020617 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 1.4), bodyMat);
    body.position.y = 0.3;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), topMat);
    top.position.set(0, 0.6, -0.05);
    top.castShadow = true;
    group.add(top);

    const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      [-0.32, 0.15, 0.6],
      [0.32, 0.15, 0.6],
      [-0.32, 0.15, -0.6],
      [0.32, 0.15, -0.6],
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, y, z);
      w.castShadow = true;
      group.add(w);
    });

    group.castShadow = true;
    group.receiveShadow = true;

    return group;
  }

  // SECTION: Game loop
  function resetGame() {
    score = 0;
    speed = baseSpeed;
    laneIndex = 1;
    isJumping = false;
    jumpTime = 0;
    lastTime = null;
    gameOver = false;
    isShielded = false;
    shieldTime = 0;

    scoreValue.textContent = '0';
    difficultyValue.textContent = currentLevel.toString();
    statusCopy.textContent = 'Dodge cars, hop water. Good luck!';
    speedDot.style.background = '#22c55e';

    buildTrack();
    if (duck) {
      duck.position.set(LANES[laneIndex], DUCK_Y_IDLE, 0);
    }
  }

  function startGame() {
    if (!scene) init3D();
    resetGame();
    gameRunning = true;
    setDifficultyButtonsEnabled(false);
    overlay.classList.add('overlay--hidden');
    overlay.setAttribute('aria-hidden', 'true');
    statusCopy.textContent = 'Stay sharp – speed ramps up as you survive.';
  }

  function endGame(reason) {
    gameRunning = false;
    gameOver = true;
    setDifficultyButtonsEnabled(true);
    overlay.classList.remove('overlay--hidden');
    overlay.removeAttribute('aria-hidden');

    let title = 'Ouch.';
    let text = 'A car clipped you. Reset and try again.';

    if (reason === 'water') {
      title = 'Splash!';
      text = 'You misjudged the canal. Time to towel off and retry.';
    }
  
    overlayTitle.textContent = title;
    overlayText.textContent = `${text} Final score: ${score.toFixed(0)}.`;
    statusCopy.textContent = 'Run ended. Hit Start to try again.';

    if (score > bestScore) {
      bestScore = Math.floor(score);
      localStorage.setItem('duckDashBest', String(bestScore));
      bestValue.textContent = bestScore;
      overlayText.textContent += ' New best!';
    }

    speedDot.style.background = '#f97373';
    speedDot.style.boxShadow = '0 0 0 6px rgba(248,113,113,0.3)';
  }

  function unlockLevel(level) {
    gameRunning = false;
    gameOver = true;
    setDifficultyButtonsEnabled(true);
    overlay.classList.remove('overlay--hidden');
    overlay.removeAttribute('aria-hidden');

    overlayTitle.textContent = `Level ${level} unlocked!`;
    overlayText.textContent = `Great job! Press Start to begin level ${level}.`;
    statusCopy.textContent = `Ready for level ${level}. Tap Start when you are set.`;
    speedDot.style.background = '#22c55e';
    speedDot.style.boxShadow = '0 0 0 6px rgba(34, 197, 94, 0.25)';
    currentLevel = level;
    difficultyValue.textContent = level.toString();
  }

  function update(delta) {
    // update shield timer
    if (isShielded) {
      shieldTime += delta;
      if (shieldTime >= SHIELD_DURATION) {
        isShielded = false;
        statusCopy.textContent = 'Shield faded. Watch the traffic!';
      }
    }
    if (!scene) return;

    // Keep speed constant at the base value
    speed = baseSpeed;
    speedDot.style.background = '#22c55e';
    speedDot.style.boxShadow = '0 0 0 6px rgba(34, 197, 94, 0.25)';

    score += delta * (1.4 + speed * 0.12);
    scoreValue.textContent = Math.floor(score).toString();

    // automatic level progression by score
    const s = Math.floor(score);
    if (currentLevel === 1 && s >= 100) {
      unlockLevel(2);
      return;
    }

    // animate duck lane lerp
    if (duck) {
      const targetX = LANES[laneIndex];
      duck.position.x += (targetX - duck.position.x) * Math.min(12 * delta, 1);

      // jump arc
      if (isJumping) {
        jumpTime += 0.016;
        const t = Math.min(jumpTime / JUMP_DURATION, 1);
        const height = Math.sin(t * Math.PI) * DUCK_JUMP_HEIGHT;
        duck.position.y = DUCK_Y_IDLE + height;
        if (t >= 1) {
          isJumping = false;
          duck.position.y = DUCK_Y_IDLE;
        }
      }

      // slight bob when idle / running
      if (!isJumping) {
        duck.position.y = DUCK_Y_IDLE + Math.sin(performance.now() / 220) * 0.03;
      }

      duck.rotation.y = THREE.MathUtils.lerp(duck.rotation.y, (LANES[laneIndex] - 0) * 0.2, 10 * delta);
    }

    // move world towards camera
    const moveAmount = speed * delta;
    [...roadGroup.children, ...waterGroup.children, ...carGroup.children, ...treeGroup.children].forEach((obj) => {
      obj.position.z += moveAmount;
    });

    // recycle segments & cars
    const segmentLength = 3.5;
    roadGroup.children.forEach((road) => {
      if (road.position.z > 5) road.position.z -= segmentLength * 18;
    });

    waterGroup.children.forEach((w) => {
      if (w.position.z > 5) w.position.z -= segmentLength * 18;
    });

    carGroup.children.forEach((car) => {
      const sCar = car.userData.speed || speed + 1;
      car.position.z += sCar * delta;
      if (car.position.z > 8) {
        // respawn further back in random lane
        const laneIndexNew = Math.floor(Math.random() * LANES.length);
        car.position.set(LANES[laneIndexNew], 0.35, -40 - Math.random() * 25);
        car.userData.speed = baseSpeed + Math.random() * 4;
      }
    });

    // collisions
    checkCollisions();
  }

  function checkCollisions() {
    if (!duck) return;
    const duckBox = new THREE.Box3().setFromObject(duck);

    // power-up pickups and hard-mode hazards
    for (const obj of roadGroup.children) {
      if (obj.userData && obj.userData.type === 'shield') {
        const box = new THREE.Box3().setFromObject(obj);
        if (duckBox.intersectsBox(box)) {
          isShielded = true;
          shieldTime = 0;
          statusCopy.textContent = 'Shielded! One hit won\'t stop you.';
          roadGroup.remove(obj);
        }
      }
    }

    // car collisions
    for (const car of carGroup.children) {
      const carBox = new THREE.Box3().setFromObject(car);
      if (duckBox.intersectsBox(carBox)) {
        if (isShielded) {
          // consume shield and knock car away
          isShielded = false;
          car.position.z += 6;
          statusCopy.textContent = 'Shield broke that hit – keep going!';
          continue;
        }
        endGame('car');
        return;
      }
    }

    // water gaps: simple check if duck is over water mesh and not jumping high
    const duckPos = duck.position;
    for (const water of waterGroup.children) {
      const box = new THREE.Box3().setFromObject(water);
      if (duckPos.x > box.min.x && duckPos.x < box.max.x && duckPos.z > box.min.z && duckPos.z < box.max.z) {
        if (duckPos.y < DUCK_Y_IDLE + DUCK_JUMP_HEIGHT * 0.18) {
          endGame('water');
          return;
        }
      }
    }
  }

  function loop(timestamp) {
    requestAnimationFrame(loop);
    if (!scene || !renderer || !camera) return;

    if (lastTime == null) lastTime = timestamp;
    const delta = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (gameRunning && !gameOver) {
      update(delta);
    }

    renderer.render(scene, camera);
  }

  // SECTION: Controls
  function moveLeft() {
    if (!gameRunning || gameOver) return;
    laneIndex = Math.max(0, laneIndex - 1);
  }

  function moveRight() {
    if (!gameRunning || gameOver) return;
    laneIndex = Math.min(LANES.length - 1, laneIndex + 1);
  }

  function jump() {
    if (!gameRunning || gameOver) return;
    if (isJumping) return;
    isJumping = true;
    jumpTime = 0;
  }

  // Difficulty button state manager
  function setDifficultyButtonsEnabled(enabled) {
    if (!easyButton || !hardButton) return;
    easyButton.disabled = !enabled;
    hardButton.disabled = !enabled;
    easyButton.style.opacity = enabled ? '1' : '0.5';
    hardButton.style.opacity = enabled ? '1' : '0.5';
    easyButton.style.pointerEvents = enabled ? 'auto' : 'none';
    hardButton.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  // Level selection buttons (still let player start in level 1 or 2)
  function setupDifficultyButtons() {
    if (!easyButton || !hardButton) {
      console.warn('Difficulty buttons not found');
      return;
    }
    
    easyButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (gameRunning || gameOver) return;
      isEasyMode = true;
      DUCK_JUMP_HEIGHT = BASE_JUMP_HEIGHT + 0.3; // 2.7
      JUMP_DURATION = BASE_JUMP_DURATION + 0.2; // 1.2

      easyButton.classList.add('difficulty__button--active');
      hardButton.classList.remove('difficulty__button--active');

      statusCopy.textContent = 'Easy mode: Longer jumps, more air time!';
    });
    
    hardButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (gameRunning || gameOver) return;
      isEasyMode = false;
      DUCK_JUMP_HEIGHT = BASE_JUMP_HEIGHT; // 2.4
      JUMP_DURATION = BASE_JUMP_DURATION; // 1.2

      hardButton.classList.add('difficulty__button--active');
      easyButton.classList.remove('difficulty__button--active');

      statusCopy.textContent = 'Hard mode: Tight, fast jumps!';
    });
  }
  
  setupDifficultyButtons();

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      moveLeft();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      moveRight();
    } else if (e.code === 'ArrowUp' || e.code === 'Space') {
      e.preventDefault();
      if (!gameRunning || gameOver) startGame();
      else jump();
    }
  });

  // Touch / click controls
  function bindButton(btn, action) {
    if (!btn) return;
    const handler = (e) => {
      e.preventDefault();
      action();
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
  }

  bindButton(touchLeft, moveLeft);
  bindButton(touchRight, moveRight);
  bindButton(touchJump, () => {
    if (!gameRunning || gameOver) startGame();
    else jump();
  });

  // Swipe up anywhere on viewport to jump
  let touchStartY = null;
  if (canvas) {
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      'touchend',
      (e) => {
        if (touchStartY == null) return;
        const dy = touchStartY - (e.changedTouches[0]?.clientY || touchStartY);
        if (dy > 40) {
          if (!gameRunning || gameOver) startGame();
          else jump();
        }
        touchStartY = null;
      },
      { passive: true }
    );
  }

  // Start button
  if (startButton) {
    startButton.addEventListener('click', (e) => {
      e.preventDefault();
      startGame();
    });
  } else {
    console.warn('Start button not found');
  }

  // Help toggle
  if (helpToggle && helpPanel) {
    helpToggle.addEventListener('click', () => {
      const isHidden = helpPanel.style.display === 'none';
      helpPanel.style.display = isHidden ? 'block' : 'none';
      helpToggle.textContent = isHidden ? 'Hide help' : 'How to play';
    });
  }

  // Initial state
  if (helpPanel) helpPanel.style.display = 'block';
  if (overlay) overlay.classList.remove('overlay--hidden');
  if (difficultyValue) difficultyValue.textContent = currentLevel.toString();
  
  // Set Easy mode as default and enable difficulty buttons
  DUCK_JUMP_HEIGHT = BASE_JUMP_HEIGHT + 0.2; // 2.3
  JUMP_DURATION = BASE_JUMP_DURATION + 0.2; // 1.0
  setDifficultyButtonsEnabled(true);

  // Kick off
  init3D();
  requestAnimationFrame(loop);
})();
