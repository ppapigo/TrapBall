export const GAME = {
  width: 1280,
  height: 720,
  field: { left: 70, right: 1210, top: 80, bottom: 680 },
  goal: { top: 280, bottom: 440, depth: 50 },
  playerSpeed: 250,
  cpuSpeed: 210,
  ballMaxSpeed: 700,
  kickStrength: 550,
  kickRange: 70,
  kickCooldown: 350,
  wallCost: 2,
  bumperCost: 3,
  initialBuildPoints: 10,
  buildPointsPerRound: 4,
  winScore: 3,
  wall: { width: 90, height: 24 },
  bumper: { radius: 24, ballBounceSpeed: 590, playerPushSpeed: 180 }
};
