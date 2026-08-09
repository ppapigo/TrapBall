import Phaser from 'phaser';
import { GAME } from '../config/gameConfig.js';

const PHASE = { BUILD: 'BUILD', PLAY: 'PLAY', GOAL: 'GOAL', GAME_OVER: 'GAME_OVER' };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.phase = PHASE.BUILD;
    this.playerScore = 0;
    this.cpuScore = 0;
    this.playerPoints = GAME.initialBuildPoints;
    this.cpuPoints = GAME.initialBuildPoints;
    this.lastPlayerKick = 0;
    this.lastCpuKick = 0;

    this.drawField();
    this.wallGroup = this.physics.add.staticGroup();
    this.createActors();
    this.createControls();
    this.createUI();

    this.physics.add.collider(this.player, this.boundaries);
    this.physics.add.collider(this.cpu, this.boundaries);
    this.physics.add.collider(this.ball, this.boundaries);
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.cpu, this.wallGroup);
    this.physics.add.collider(this.ball, this.wallGroup);
    this.physics.add.collider(this.player, this.cpu);
    this.physics.add.collider(this.player, this.ball);
    this.physics.add.collider(this.cpu, this.ball);

    this.preview = this.add.rectangle(0, 0, GAME.wall.width, GAME.wall.height, 0x9aa0a6, 0.55)
      .setStrokeStyle(2, 0xffffff).setDepth(5);
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
    this.player = this.add.circle(260, 380, 22, 0x248bff).setStrokeStyle(3, 0xb9dcff);
    this.cpu = this.add.circle(1020, 380, 22, 0xef4444).setStrokeStyle(3, 0xffbbbb);
    this.ball = this.add.circle(640, 380, 12, 0xffffff).setStrokeStyle(2, 0x222222);
    this.physics.add.existing(this.player);
    this.physics.add.existing(this.cpu);
    this.physics.add.existing(this.ball);
    for (const actor of [this.player, this.cpu]) {
      actor.body.setCircle(22).setCollideWorldBounds(false);
      actor.body.setBounce(0.15).setDrag(900, 900).setMaxVelocity(350, 350);
    }
    this.ball.body.setCircle(12).setBounce(0.88).setDrag(105, 105).setMaxVelocity(GAME.ballMaxSpeed, GAME.ballMaxSpeed);
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
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
      this.updatePreview();
      if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.startPlay();
      return;
    }
    this.preview.setVisible(false);
    if (this.phase !== PHASE.PLAY) return;

    this.updatePlayer(time);
    this.updateCpu(time);
    this.capBallSpeed();
    this.checkGoal();
  }

  updatePlayer(time) {
    let x = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    let y = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const direction = new Phaser.Math.Vector2(x, y);
    if (direction.lengthSq() > 0) direction.normalize().scale(GAME.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);

    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    this.aimLine.clear().lineStyle(4, 0x9ed0ff, 0.9)
      .lineBetween(this.player.x, this.player.y, this.player.x + Math.cos(angle) * 36, this.player.y + Math.sin(angle) * 36);
  }

  updateCpu(time) {
    const toBall = new Phaser.Math.Vector2(this.ball.x - this.cpu.x, this.ball.y - this.cpu.y);
    const distance = toBall.length();
    if (distance > 1) toBall.normalize();
    // Add a small vertical bias when stuck behind a wall.
    if (this.cpu.body.blocked.left || this.cpu.body.blocked.right) toBall.y += this.cpu.y < 360 ? 0.65 : -0.65;
    toBall.normalize().scale(GAME.cpuSpeed);
    this.cpu.body.setVelocity(toBall.x, toBall.y);

    if (distance <= GAME.kickRange && time - this.lastCpuKick >= GAME.kickCooldown + 100) {
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
      this.placePlayerWall(pointer.worldX, pointer.worldY);
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
  }

  capBallSpeed() {
    const velocity = this.ball.body.velocity;
    if (velocity.length() > GAME.ballMaxSpeed) velocity.normalize().scale(GAME.ballMaxSpeed);
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
    this.bannerText.setText(`${scorer} GOAL!`).setVisible(true);
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
  }

  updatePreview() {
    const pointer = this.input.activePointer;
    const x = Phaser.Math.Snap.To(pointer.worldX, 10);
    const y = Phaser.Math.Snap.To(pointer.worldY, 10);
    const valid = this.canPlaceWall(x, y, 'PLAYER') && this.playerPoints >= GAME.wallCost;
    this.preview.setPosition(x, y).setFillStyle(valid ? 0x87d68d : 0xe55b5b, 0.55).setVisible(true);
  }

  placePlayerWall(x, y) {
    x = Phaser.Math.Snap.To(x, 10);
    y = Phaser.Math.Snap.To(y, 10);
    if (this.playerPoints < GAME.wallCost || !this.canPlaceWall(x, y, 'PLAYER')) return;
    this.addWall(x, y, 0x8f979e);
    this.playerPoints -= GAME.wallCost;
    this.updateUI();
  }

  cpuBuild() {
    let attempts = 0;
    while (this.cpuPoints >= GAME.wallCost && attempts < 160) {
      attempts += 1;
      const x = Phaser.Math.Snap.To(Phaser.Math.Between(720, 1150), 10);
      const y = Phaser.Math.Snap.To(Phaser.Math.Between(120, 640), 10);
      if (!this.canPlaceWall(x, y, 'CPU')) continue;
      this.addWall(x, y, 0x7d858c);
      this.cpuPoints -= GAME.wallCost;
    }
  }

  canPlaceWall(x, y, side) {
    const halfW = GAME.wall.width / 2;
    const halfH = GAME.wall.height / 2;
    const f = GAME.field;
    if (y - halfH < f.top + 12 || y + halfH > f.bottom - 12) return false;
    if (side === 'PLAYER' && (x - halfW < f.left + 20 || x + halfW > 580)) return false;
    if (side === 'CPU' && (x - halfW < 700 || x + halfW > f.right - 20)) return false;
    if (side === 'PLAYER' && x < 225 && y > 235 && y < 485) return false;
    if (side === 'CPU' && x > 1055 && y > 235 && y < 485) return false;

    const candidate = new Phaser.Geom.Rectangle(x - halfW - 8, y - halfH - 8, GAME.wall.width + 16, GAME.wall.height + 16);
    const starts = [
      new Phaser.Geom.Rectangle(225, 345, 70, 70),
      new Phaser.Geom.Rectangle(985, 345, 70, 70),
      new Phaser.Geom.Rectangle(605, 345, 70, 70)
    ];
    if (starts.some((r) => Phaser.Geom.Intersects.RectangleToRectangle(candidate, r))) return false;
    return !this.wallGroup.getChildren().some((wall) => {
      const bounds = new Phaser.Geom.Rectangle(wall.x - halfW - 8, wall.y - halfH - 8, GAME.wall.width + 16, GAME.wall.height + 16);
      return Phaser.Geom.Intersects.RectangleToRectangle(candidate, bounds);
    });
  }

  addWall(x, y, color) {
    const wall = this.add.rectangle(x, y, GAME.wall.width, GAME.wall.height, color).setStrokeStyle(2, 0x30353a);
    this.wallGroup.add(wall);
  }

  gameOver() {
    this.phase = PHASE.GAME_OVER;
    this.player.body.setVelocity(0);
    this.cpu.body.setVelocity(0);
    this.ball.body.setVelocity(0);
    const winner = this.playerScore > this.cpuScore ? 'PLAYER WINS' : 'CPU WINS';
    this.bannerText.setText(winner).setVisible(true);
    this.restartButton.setVisible(true);
    this.updateUI();
  }

  updateUI() {
    this.scoreText.setText(`PLAYER ${this.playerScore}  :  ${this.cpuScore} CPU`);
    this.phaseText.setText(`${this.phase} PHASE`);
    if (this.phase === PHASE.BUILD) {
      this.infoText.setText(`Build Points: ${this.playerPoints}   Wall Cost: ${GAME.wallCost}\nLeft Click: Place Wall   Right Click / Enter: Start Match`);
    } else if (this.phase === PHASE.PLAY) {
      this.infoText.setText('WASD Move   Mouse Aim   Left Click Kick');
    } else if (this.phase === PHASE.GOAL) {
      this.infoText.setText('Next build phase starts shortly...');
    } else {
      this.infoText.setText('First to 3 wins');
    }
  }
}
