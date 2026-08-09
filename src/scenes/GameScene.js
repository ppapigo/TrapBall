import Phaser from 'phaser';
import { GAME } from '../config/gameConfig.js';
import { ASSET_MANIFEST, SOUND_KEYS, TEXTURE_KEYS } from '../config/assetConfig.js';

const PHASE = { BUILD: 'BUILD', PLAY: 'PLAY', GOAL: 'GOAL', GAME_OVER: 'GAME_OVER' };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    ASSET_MANIFEST.images.filter((asset) => asset.enabled).forEach((asset) => this.load.image(asset.key, asset.path));
    ASSET_MANIFEST.sounds.filter((asset) => asset.enabled).forEach((asset) => this.load.audio(asset.key, asset.path));
  }

  create() {
    this.phase = PHASE.BUILD;
    this.playerScore = 0;
    this.cpuScore = 0;
    this.playerPoints = GAME.initialBuildPoints;
    this.cpuPoints = GAME.initialBuildPoints;
    this.lastPlayerKick = 0;
    this.lastCpuKick = 0;
    this.lastTrailTime = 0;
    this.selectedObstacle = 'WALL';
    this.wallRotation = 0;
    this.ballStillSince = 0;
    this.lastCpuPositionCheck = 0;
    this.cpuCheckPosition = new Phaser.Math.Vector2(1020, 380);
    this.cpuStuckUntil = 0;
    this.cpuDetourSign = 1;

    this.drawField();
    this.wallGroup = this.physics.add.staticGroup();
    this.bumperGroup = this.physics.add.staticGroup();
    this.boostGroup = this.physics.add.staticGroup();
    this.createActors();
    this.createControls();
    this.createUI();

    this.physics.add.collider(this.player, this.boundaries);
    this.physics.add.collider(this.cpu, this.boundaries);
    this.physics.add.collider(this.ball, this.boundaries);
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.cpu, this.wallGroup);
    this.physics.add.collider(this.ball, this.wallGroup);
    this.physics.add.collider(this.player, this.bumperGroup, this.onActorBumper, null, this);
    this.physics.add.collider(this.cpu, this.bumperGroup, this.onActorBumper, null, this);
    this.physics.add.collider(this.ball, this.bumperGroup, this.onBallBumper, null, this);
    this.physics.add.collider(this.player, this.cpu);
    this.physics.add.collider(this.player, this.ball);
    this.physics.add.collider(this.cpu, this.ball);
    this.physics.add.overlap(this.player, this.boostGroup, this.onActorBoost, null, this);
    this.physics.add.overlap(this.cpu, this.boostGroup, this.onActorBoost, null, this);
    this.physics.add.overlap(this.ball, this.boostGroup, this.onBallBoost, null, this);

    this.preview = this.add.rectangle(0, 0, GAME.wall.width, GAME.wall.height, 0x9aa0a6, 0.55)
      .setStrokeStyle(2, 0xffffff).setDepth(5);
    this.bumperPreview = this.add.circle(0, 0, GAME.bumper.radius, 0xf2b84b, 0.55)
      .setStrokeStyle(2, 0xffffff).setDepth(5).setVisible(false);
    this.boostPreview = this.add.rectangle(0, 0, GAME.boostPad.width, GAME.boostPad.height, 0x27d7d7, 0.55)
      .setStrokeStyle(2, 0xffffff).setDepth(5).setVisible(false);
    this.aimLine = this.add.graphics().setDepth(6);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.beginBuild(false);
  }

  drawField() {
    const f = GAME.field;
    this.add.rectangle(640, 380, f.right - f.left, f.bottom - f.top, 0x287a3e)
      .setStrokeStyle(4, 0xf2f2f2);
    this.add.line(0, 0, 640, f.top, 640, f.bottom, 0xffffff, 0.65).setOrigin(0);
    this.add.circle(640, 380, 90).setStrokeStyle(3, 0xffffff, 0.65);
    this.add.rectangle(45, 360, 50, GAME.goal.bottom - GAME.goal.top, 0x287dcc, 0.35)
      .setStrokeStyle(4, 0x51a8ff);
    this.add.rectangle(1235, 360, 50, GAME.goal.bottom - GAME.goal.top, 0xcc3434, 0.35)
      .setStrokeStyle(4, 0xff6666);

    this.boundaries = this.physics.add.staticGroup();
    const addBoundary = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h, 0x142d1c, 0);
      this.boundaries.add(r);
    };
    addBoundary(640, f.top - 10, 1240, 20);
    addBoundary(640, f.bottom + 10, 1240, 20);
    const segmentH = GAME.goal.top - f.top;
    addBoundary(f.left - 10, f.top + segmentH / 2, 20, segmentH);
    addBoundary(f.left - 10, GAME.goal.bottom + segmentH / 2, 20, segmentH);
    addBoundary(f.right + 10, f.top + segmentH / 2, 20, segmentH);
    addBoundary(f.right + 10, GAME.goal.bottom + segmentH / 2, 20, segmentH);
    addBoundary(10, 360, 20, GAME.goal.bottom - GAME.goal.top + 40);
    addBoundary(1270, 360, 20, GAME.goal.bottom - GAME.goal.top + 40);
    addBoundary(35, GAME.goal.top - 10, 50, 20);
    addBoundary(35, GAME.goal.bottom + 10, 50, 20);
    addBoundary(1245, GAME.goal.top - 10, 50, 20);
    addBoundary(1245, GAME.goal.bottom + 10, 50, 20);
  }

  createActors() {
    this.player = this.createVisual(TEXTURE_KEYS.playerBlue, 260, 380, 38, 52,
      () => this.add.circle(260, 380, 22, 0x248bff).setStrokeStyle(3, 0xb9dcff));
    this.cpu = this.createVisual(TEXTURE_KEYS.playerRed, 1020, 380, 38, 52,
      () => this.add.circle(1020, 380, 22, 0xef4444).setStrokeStyle(3, 0xffbbbb));
    this.ball = this.createVisual(TEXTURE_KEYS.ball, 640, 380, 24, 24,
      () => this.add.circle(640, 380, 12, 0xffffff).setStrokeStyle(2, 0x222222));
    this.physics.add.existing(this.player);
    this.physics.add.existing(this.cpu);
    this.physics.add.existing(this.ball);
    for (const actor of [this.player, this.cpu]) {
      actor.body.setCircle(22).setCollideWorldBounds(false);
      actor.body.setBounce(0.15).setDrag(900, 900).setMaxVelocity(350, 350);
    }
    this.ball.body.setCircle(12).setBounce(0.88).setDrag(GAME.ballDrag, GAME.ballDrag).setMaxVelocity(GAME.ballMaxSpeed, GAME.ballMaxSpeed);
  }

  createVisual(textureKey, x, y, width, height, fallbackFactory) {
    if (this.textures.exists(textureKey)) {
      const asset = ASSET_MANIFEST.images.find((item) => item.key === textureKey);
      const texture = this.textures.get(textureKey);
      const frameName = 'trimmed';
      if (asset?.crop && !texture.has(frameName)) texture.add(frameName, 0, ...asset.crop);
      return this.add.image(x, y, textureKey, asset?.crop ? frameName : undefined).setDisplaySize(width, height);
    }
    return fallbackFactory();
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.wallKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.bumperKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.boostKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.rotateKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  createUI() {
    const textStyle = { fontFamily: 'Arial', color: '#ffffff', stroke: '#111111', strokeThickness: 4 };
    this.scoreText = this.add.text(640, 18, '', { ...textStyle, fontSize: '28px', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(10);
    this.phaseText = this.add.text(22, 18, '', { ...textStyle, fontSize: '22px', fontStyle: 'bold' }).setDepth(10);
    this.infoText = this.add.text(22, 52, '', { ...textStyle, fontSize: '16px' }).setDepth(10);
    this.bannerText = this.add.text(640, 345, '', { ...textStyle, fontSize: '52px', fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5).setDepth(20);
    this.restartButton = this.add.text(640, 430, 'RESTART', {
      ...textStyle, fontSize: '28px', backgroundColor: '#2864b7', padding: { x: 22, y: 12 }
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true }).setVisible(false);
    this.restartButton.on('pointerdown', () => this.scene.restart());
    this.updateUI();
  }

  update(time) {
    if (this.phase === PHASE.BUILD) {
      this.player.body.setVelocity(0);
      this.cpu.body.setVelocity(0);
      this.ball.body.setVelocity(0);
      if (Phaser.Input.Keyboard.JustDown(this.wallKey)) {
        this.selectedObstacle = 'WALL';
        this.updateUI();
      }
      if (Phaser.Input.Keyboard.JustDown(this.bumperKey)) {
        this.selectedObstacle = 'BUMPER';
        this.updateUI();
      }
      if (Phaser.Input.Keyboard.JustDown(this.boostKey)) {
        this.selectedObstacle = 'BOOST';
        this.updateUI();
      }
      if (this.selectedObstacle === 'WALL' && Phaser.Input.Keyboard.JustDown(this.rotateKey)) {
        this.wallRotation = this.wallRotation === 0 ? 90 : 0;
        this.updateUI();
      }
      this.updatePreview();
      if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.startPlay();
      return;
    }
    this.preview.setVisible(false);
    this.bumperPreview.setVisible(false);
    this.boostPreview.setVisible(false);
    if (this.phase !== PHASE.PLAY) return;

    this.updatePlayer(time);
    this.updateCpu(time);
    this.capBallSpeed();
    this.updateBallTrail(time);
    this.recoverStuckBall(time);
    this.checkGoal();
  }

  updatePlayer(time) {
    if (this.player.bumpUntil > time) {
      this.player.body.setVelocity(this.player.bumpVelocity.x, this.player.bumpVelocity.y);
      return;
    }
    let x = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    let y = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const direction = new Phaser.Math.Vector2(x, y);
    const speed = GAME.playerSpeed * (this.player.boostUntil > time ? GAME.boostPad.actorMultiplier : 1);
    if (direction.lengthSq() > 0) direction.normalize().scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);

    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    this.aimLine.clear().lineStyle(4, 0x9ed0ff, 0.9)
      .lineBetween(this.player.x, this.player.y, this.player.x + Math.cos(angle) * 36, this.player.y + Math.sin(angle) * 36);
  }

  updateCpu(time) {
    if (this.cpu.bumpUntil > time) {
      this.cpu.body.setVelocity(this.cpu.bumpVelocity.x, this.cpu.bumpVelocity.y);
      return;
    }
    const toBall = new Phaser.Math.Vector2(this.ball.x - this.cpu.x, this.ball.y - this.cpu.y);
    const distance = toBall.length();
    if (distance > 1) toBall.normalize();
    if (time - this.lastCpuPositionCheck >= 700) {
      const moved = Phaser.Math.Distance.Between(this.cpu.x, this.cpu.y, this.cpuCheckPosition.x, this.cpuCheckPosition.y);
      if (moved < 7 && distance > GAME.kickRange) {
        this.cpuStuckUntil = time + 900;
        this.cpuDetourSign *= -1;
      }
      this.cpuCheckPosition.set(this.cpu.x, this.cpu.y);
      this.lastCpuPositionCheck = time;
    }
    if (time < this.cpuStuckUntil) {
      const detourX = -toBall.y * this.cpuDetourSign;
      const detourY = toBall.x * this.cpuDetourSign;
      toBall.add(new Phaser.Math.Vector2(detourX, detourY).scale(0.75));
    }
    // Add a small vertical bias when stuck behind a wall.
    if (this.cpu.body.blocked.left || this.cpu.body.blocked.right) toBall.y += this.cpu.y < 360 ? 0.65 : -0.65;
    const speed = GAME.cpuSpeed * (this.cpu.boostUntil > time ? GAME.boostPad.actorMultiplier : 1);
    toBall.normalize().scale(speed);
    this.cpu.body.setVelocity(toBall.x, toBall.y);

    if (distance <= GAME.kickRange && time - this.lastCpuKick >= GAME.cpuKickCooldown) {
      const targetY = Phaser.Math.Clamp(360 + Phaser.Math.Between(-45, 45), GAME.goal.top + 20, GAME.goal.bottom - 20);
      const kick = new Phaser.Math.Vector2(25 - this.ball.x, targetY - this.ball.y).normalize();
      this.ball.body.setVelocity(kick.x * GAME.kickStrength, kick.y * GAME.kickStrength);
      this.lastCpuKick = time;
    }
  }

  onPointerDown(pointer) {
    if (pointer.rightButtonDown()) {
      if (this.phase === PHASE.BUILD) this.startPlay();
      return;
    }
    if (pointer.button !== 0) return;
    if (this.phase === PHASE.BUILD) {
      this.placePlayerObstacle(pointer.worldX, pointer.worldY);
    } else if (this.phase === PHASE.PLAY) {
      this.playerKick(pointer.worldX, pointer.worldY);
    }
  }

  playerKick(targetX, targetY) {
    const now = this.time.now;
    if (now - this.lastPlayerKick < GAME.kickCooldown) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ball.x, this.ball.y) > GAME.kickRange) return;
    const kick = new Phaser.Math.Vector2(targetX - this.player.x, targetY - this.player.y);
    if (kick.lengthSq() === 0) return;
    kick.normalize();
    this.ball.body.setVelocity(kick.x * GAME.kickStrength, kick.y * GAME.kickStrength);
    this.lastPlayerKick = now;
    this.playKickFeedback();
    this.playOptionalSound(SOUND_KEYS.kick);
  }

  capBallSpeed() {
    const velocity = this.ball.body.velocity;
    if (velocity.length() > GAME.ballMaxSpeed) velocity.normalize().scale(GAME.ballMaxSpeed);
  }

  updateBallTrail(time) {
    if (this.ball.body.velocity.length() < 280 || time - this.lastTrailTime < 55) return;
    this.lastTrailTime = time;
    const trail = this.add.circle(this.ball.x, this.ball.y, 7, 0xffffff, 0.28).setDepth(3);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 0.35,
      duration: 220,
      onComplete: () => trail.destroy()
    });
  }

  playKickFeedback() {
    this.tweens.killTweensOf(this.player);
    this.player.setScale(1);
    this.tweens.add({ targets: this.player, scale: 1.12, duration: 45, yoyo: true });
    this.createImpactRing(this.ball.x, this.ball.y, 0x9ed0ff, 16, 150);
  }

  createImpactRing(x, y, color, radius, duration) {
    const ring = this.add.graphics({ x, y }).setDepth(8);
    ring.lineStyle(3, color, 0.9).strokeCircle(0, 0, radius);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.65,
      duration,
      onComplete: () => ring.destroy()
    });
  }

  recoverStuckBall(time) {
    if (this.ball.body.velocity.length() >= 18) {
      this.ballStillSince = 0;
      return;
    }
    if (!this.ballStillSince) this.ballStillSince = time;
    if (time - this.ballStillSince < 4000) return;
    this.ball.setPosition(640, 380).body.setVelocity(0);
    this.ballStillSince = time;
  }

  checkGoal() {
    const insideMouth = this.ball.y - 12 > GAME.goal.top && this.ball.y + 12 < GAME.goal.bottom;
    if (!insideMouth) return;
    if (this.ball.x + 12 < GAME.field.left) this.scoreGoal('CPU');
    else if (this.ball.x - 12 > GAME.field.right) this.scoreGoal('PLAYER');
  }

  scoreGoal(scorer) {
    if (this.phase !== PHASE.PLAY) return;
    this.phase = PHASE.GOAL;
    this.player.body.setVelocity(0);
    this.cpu.body.setVelocity(0);
    this.ball.body.setVelocity(0);
    if (scorer === 'PLAYER') this.playerScore += 1;
    else this.cpuScore += 1;
    this.playOptionalSound(SOUND_KEYS.goal);
    this.createGoalBurst(this.ball.x, this.ball.y);
    this.cameras.main.shake(180, 0.008);
    this.bannerText.setText('GOAL!').setVisible(true);
    this.time.delayedCall(800, () => {
      if (this.phase === PHASE.GOAL) this.bannerText.setVisible(false);
    });
    this.updateUI();

    if (this.playerScore >= GAME.winScore || this.cpuScore >= GAME.winScore) {
      this.time.delayedCall(900, () => this.gameOver());
    } else {
      this.time.delayedCall(1000, () => {
        this.playerPoints += GAME.buildPointsPerRound;
        this.cpuPoints += GAME.buildPointsPerRound;
        this.resetActors();
        this.beginBuild(true);
      });
    }
  }

  beginBuild(addCpuWalls) {
    this.phase = PHASE.BUILD;
    this.bannerText.setText('BUILD PHASE').setVisible(true);
    this.time.delayedCall(650, () => {
      if (this.phase === PHASE.BUILD) this.bannerText.setVisible(false);
    });
    if (addCpuWalls || this.wallGroup.getLength() === 0) this.cpuBuild();
    this.updateUI();
  }

  startPlay() {
    if (this.phase !== PHASE.BUILD) return;
    this.phase = PHASE.PLAY;
    this.lastCpuPositionCheck = this.time.now;
    this.cpuCheckPosition.set(this.cpu.x, this.cpu.y);
    this.cpuStuckUntil = 0;
    this.ballStillSince = 0;
    this.bannerText.setText('KICK OFF!').setVisible(true);
    this.time.delayedCall(500, () => {
      if (this.phase === PHASE.PLAY) this.bannerText.setVisible(false);
    });
    this.updateUI();
  }

  resetActors() {
    this.player.setPosition(260, 380).body.setVelocity(0);
    this.cpu.setPosition(1020, 380).body.setVelocity(0);
    this.ball.setPosition(640, 380).body.setVelocity(0);
    this.ballStillSince = 0;
    this.cpuCheckPosition.set(1020, 380);
    this.lastCpuPositionCheck = this.time.now;
    this.cpuStuckUntil = 0;
  }

  updatePreview() {
    const pointer = this.input.activePointer;
    const x = Phaser.Math.Snap.To(pointer.worldX, 10);
    const y = Phaser.Math.Snap.To(pointer.worldY, 10);
    const cost = this.selectedObstacle === 'WALL' ? GAME.wallCost : (this.selectedObstacle === 'BUMPER' ? GAME.bumperCost : GAME.boostPadCost);
    const valid = this.canPlaceWall(x, y, 'PLAYER', this.selectedObstacle, this.wallRotation) && this.playerPoints >= cost;
    this.preview.setVisible(this.selectedObstacle === 'WALL');
    this.bumperPreview.setVisible(this.selectedObstacle === 'BUMPER');
    this.boostPreview.setVisible(this.selectedObstacle === 'BOOST');
    this.preview.setAngle(this.wallRotation);
    const activePreview = this.selectedObstacle === 'BUMPER' ? this.bumperPreview : (this.selectedObstacle === 'BOOST' ? this.boostPreview : this.preview);
    const validColor = this.selectedObstacle === 'BOOST' ? 0x27d7d7 : (this.selectedObstacle === 'BUMPER' ? 0xf2b84b : 0x87d68d);
    activePreview.setPosition(x, y).setFillStyle(valid ? validColor : 0xe55b5b, 0.55);
  }

  placePlayerObstacle(x, y) {
    x = Phaser.Math.Snap.To(x, 10);
    y = Phaser.Math.Snap.To(y, 10);
    const cost = this.selectedObstacle === 'WALL' ? GAME.wallCost : (this.selectedObstacle === 'BUMPER' ? GAME.bumperCost : GAME.boostPadCost);
    if (this.playerPoints < cost || !this.canPlaceWall(x, y, 'PLAYER', this.selectedObstacle, this.wallRotation)) return;
    if (this.selectedObstacle === 'BUMPER') this.addBumper(x, y);
    else if (this.selectedObstacle === 'BOOST') this.addBoostPad(x, y, 'PLAYER');
    else this.addWall(x, y, 0x8f979e, this.wallRotation);
    this.playerPoints -= cost;
    this.updateUI();
  }

  cpuBuild() {
    let attempts = 0;
    while (this.cpuPoints >= GAME.wallCost && attempts < 160) {
      attempts += 1;
      const x = Phaser.Math.Snap.To(Phaser.Math.Between(720, 1150), 10);
      const y = Phaser.Math.Snap.To(Phaser.Math.Between(120, 640), 10);
      const type = this.cpuPoints >= 3 ? Phaser.Utils.Array.GetRandom(['WALL', 'BUMPER', 'BOOST']) : 'WALL';
      const cost = type === 'WALL' ? GAME.wallCost : (type === 'BUMPER' ? GAME.bumperCost : GAME.boostPadCost);
      if (!this.canPlaceWall(x, y, 'CPU', type)) continue;
      if (type === 'BUMPER') this.addBumper(x, y);
      else if (type === 'BOOST') this.addBoostPad(x, y, 'CPU');
      else this.addWall(x, y, 0x7d858c);
      this.cpuPoints -= cost;
    }
  }

  canPlaceWall(x, y, side, type = 'WALL', rotation = 0) {
    const rotatedWall = type === 'WALL' && rotation === 90;
    const width = type === 'BUMPER' ? GAME.bumper.radius * 2 : (type === 'BOOST' ? GAME.boostPad.width : (rotatedWall ? GAME.wall.height : GAME.wall.width));
    const height = type === 'BUMPER' ? GAME.bumper.radius * 2 : (type === 'BOOST' ? GAME.boostPad.height : (rotatedWall ? GAME.wall.width : GAME.wall.height));
    const halfW = width / 2;
    const halfH = height / 2;
    const f = GAME.field;
    if (y - halfH < f.top + 12 || y + halfH > f.bottom - 12) return false;
    if (side === 'PLAYER' && (x - halfW < f.left + 20 || x + halfW > 580)) return false;
    if (side === 'CPU' && (x - halfW < 700 || x + halfW > f.right - 20)) return false;
    if (side === 'PLAYER' && x < 275 && y > 235 && y < 485) return false;
    if (side === 'CPU' && x > 1005 && y > 235 && y < 485) return false;

    const candidate = new Phaser.Geom.Rectangle(x - halfW - 8, y - halfH - 8, width + 16, height + 16);
    const starts = [
      new Phaser.Geom.Rectangle(225, 345, 70, 70),
      new Phaser.Geom.Rectangle(985, 345, 70, 70),
      new Phaser.Geom.Rectangle(605, 345, 70, 70)
    ];
    if (starts.some((r) => Phaser.Geom.Intersects.RectangleToRectangle(candidate, r))) return false;
    const obstacles = [...this.wallGroup.getChildren(), ...this.bumperGroup.getChildren(), ...this.boostGroup.getChildren()];
    return !obstacles.some((obstacle) => {
      const obstacleW = obstacle.placementWidth;
      const obstacleH = obstacle.placementHeight;
      const bounds = new Phaser.Geom.Rectangle(obstacle.x - obstacleW / 2 - 8, obstacle.y - obstacleH / 2 - 8, obstacleW + 16, obstacleH + 16);
      return Phaser.Geom.Intersects.RectangleToRectangle(candidate, bounds);
    });
  }

  addWall(x, y, color, rotation = 0) {
    const wall = this.createVisual(TEXTURE_KEYS.wall, x, y, GAME.wall.width, GAME.wall.height,
      () => this.add.rectangle(x, y, GAME.wall.width, GAME.wall.height, color).setStrokeStyle(2, 0x30353a)).setAngle(rotation);
    wall.placementWidth = rotation === 90 ? GAME.wall.height : GAME.wall.width;
    wall.placementHeight = rotation === 90 ? GAME.wall.width : GAME.wall.height;
    this.wallGroup.add(wall);
    wall.body.setSize(wall.placementWidth, wall.placementHeight);
    wall.body.position.set(x - wall.placementWidth / 2, y - wall.placementHeight / 2);
  }

  addBumper(x, y) {
    const size = GAME.bumper.radius * 2;
    const bumper = this.createVisual(TEXTURE_KEYS.bumper, x, y, size, size,
      () => this.add.circle(x, y, GAME.bumper.radius, 0xf2b84b).setStrokeStyle(4, 0xffe19a));
    bumper.placementWidth = GAME.bumper.radius * 2;
    bumper.placementHeight = GAME.bumper.radius * 2;
    this.bumperGroup.add(bumper);
    bumper.body.setCircle(GAME.bumper.radius);
  }

  addBoostPad(x, y, side) {
    const hasTexture = this.textures.exists(TEXTURE_KEYS.boostPad);
    const pad = this.createVisual(TEXTURE_KEYS.boostPad, x, y, 48, 48,
      () => this.add.rectangle(x, y, GAME.boostPad.width, GAME.boostPad.height, 0x1ba7aa, 0.72)
        .setStrokeStyle(2, 0x8fffff)).setDepth(2);
    const points = side === 'PLAYER' ? [-14, -10, -14, 10, 15, 0] : [14, -10, 14, 10, -15, 0];
    pad.arrow = hasTexture ? null : this.add.triangle(x, y, ...points, 0xd7ffff, 0.9).setDepth(3);
    pad.placementWidth = GAME.boostPad.width;
    pad.placementHeight = GAME.boostPad.height;
    this.boostGroup.add(pad);
    pad.body.setSize(GAME.boostPad.width, GAME.boostPad.height);
    pad.body.position.set(x - GAME.boostPad.width / 2, y - GAME.boostPad.height / 2);
  }

  onActorBoost(actor, pad) {
    if (this.time.now < (actor.boostCooldownUntil || 0)) return;
    actor.boostUntil = this.time.now + GAME.boostPad.duration;
    actor.boostCooldownUntil = this.time.now + GAME.boostPad.duration + 300;
    this.playBoostFeedback(pad);
  }

  onBallBoost(ball, pad) {
    if (this.time.now < (ball.boostCooldownUntil || 0) || ball.body.velocity.length() < 20) return;
    const speed = Math.min(GAME.ballMaxSpeed, ball.body.velocity.length() * GAME.boostPad.ballMultiplier);
    ball.body.velocity.normalize().scale(speed);
    ball.boostCooldownUntil = this.time.now + 500;
    this.playBoostFeedback(pad);
  }

  playBoostFeedback(pad) {
    if (this.time.now - (pad.lastFlashTime || 0) < 120) return;
    pad.lastFlashTime = this.time.now;
    this.tweens.killTweensOf(pad.arrow ? [pad, pad.arrow] : pad);
    pad.setAlpha(1);
    if (pad.arrow) pad.arrow.setScale(1.2).setAlpha(1);
    this.tweens.add({ targets: pad, alpha: 0.72, duration: 180 });
    if (pad.arrow) this.tweens.add({ targets: pad.arrow, scale: 1, alpha: 0.9, duration: 180 });
  }

  onBallBumper(ball, bumper) {
    const bounce = new Phaser.Math.Vector2(ball.x - bumper.x, ball.y - bumper.y);
    if (bounce.lengthSq() === 0) bounce.set(1, 0);
    bounce.normalize().scale(GAME.bumper.ballBounceSpeed);
    ball.body.setVelocity(bounce.x, bounce.y);
    this.playBumperFeedback(bumper, 1.16);
    this.playOptionalSound(SOUND_KEYS.bumper);
  }

  onActorBumper(actor, bumper) {
    const push = new Phaser.Math.Vector2(actor.x - bumper.x, actor.y - bumper.y);
    if (push.lengthSq() === 0) push.set(1, 0);
    actor.bumpVelocity = push.normalize().scale(GAME.bumper.playerPushSpeed);
    actor.bumpUntil = this.time.now + 120;
    this.playBumperFeedback(bumper, 1.08);
  }

  playBumperFeedback(bumper, scale) {
    if (this.time.now - (bumper.lastFeedbackTime || 0) < 120) return;
    bumper.lastFeedbackTime = this.time.now;
    this.tweens.killTweensOf(bumper);
    bumper.setScale(1);
    this.tweens.add({ targets: bumper, scale, duration: 55, yoyo: true });
    this.createImpactRing(bumper.x, bumper.y, 0xffd166, GAME.bumper.radius + 4, 180);
  }

  createGoalBurst(x, y) {
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8 + Phaser.Math.FloatBetween(-0.18, 0.18);
      const distance = Phaser.Math.Between(38, 72);
      const particle = this.add.circle(x, y, Phaser.Math.Between(3, 6), i % 2 ? 0xffe066 : 0xffffff).setDepth(12);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.25,
        duration: Phaser.Math.Between(340, 480),
        onComplete: () => particle.destroy()
      });
    }
  }

  gameOver() {
    this.phase = PHASE.GAME_OVER;
    this.player.body.setVelocity(0);
    this.cpu.body.setVelocity(0);
    this.ball.body.setVelocity(0);
    const winner = this.playerScore > this.cpuScore ? 'PLAYER WINS' : 'CPU WINS';
    this.bannerText.setText(winner).setColor(this.playerScore > this.cpuScore ? '#7fc4ff' : '#ff8b8b').setScale(1.18).setVisible(true);
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 280, ease: 'Back.Out' });
    this.playOptionalSound(SOUND_KEYS.victory);
    this.restartButton.setVisible(true);
    this.updateUI();
  }

  playOptionalSound(key) {
    if (this.cache.audio.exists(key)) this.sound.play(key);
  }

  updateUI() {
    this.scoreText.setText(`PLAYER ${this.playerScore}  :  ${this.cpuScore} CPU`);
    this.phaseText.setText(`${this.phase} PHASE`);
    if (this.phase === PHASE.BUILD) {
      const selectedCost = this.selectedObstacle === 'WALL' ? GAME.wallCost : (this.selectedObstacle === 'BUMPER' ? GAME.bumperCost : GAME.boostPadCost);
      const selectedName = this.selectedObstacle === 'WALL' ? 'Wall' : (this.selectedObstacle === 'BUMPER' ? 'Bumper' : 'Boost Pad');
      const rotationText = this.selectedObstacle === 'WALL' ? `   Rotation: ${this.wallRotation}° (R)` : '';
      this.infoText.setText(`Build Points: ${this.playerPoints}   Selected: ${selectedName} - Cost ${selectedCost}${rotationText}\n1: Wall (${GAME.wallCost})   2: Bumper (${GAME.bumperCost})   3: Boost Pad (${GAME.boostPadCost})   Left Click: Place   Right Click / Enter: Start`);
    } else if (this.phase === PHASE.PLAY) {
      this.infoText.setText('WASD Move   Mouse Aim   Left Click Kick');
    } else if (this.phase === PHASE.GOAL) {
      this.infoText.setText('Next build phase starts shortly...');
    } else {
      this.infoText.setText('First to 3 wins');
    }
  }
}
