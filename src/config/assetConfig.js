export const TEXTURE_KEYS = {
  playerBlue: 'player_blue',
  playerRed: 'player_red',
  ball: 'ball',
  wall: 'wall',
  bumper: 'bumper',
  boostPad: 'boost_pad'
};

export const SOUND_KEYS = {
  kick: 'kick',
  bumper: 'bumper',
  goal: 'goal',
  victory: 'victory'
};

// Add the file at path, then change enabled to true. Disabled entries are not requested.
export const ASSET_MANIFEST = {
  images: [
    { key: TEXTURE_KEYS.playerBlue, path: 'assets/player/player_blue.png', enabled: true, crop: [112, 48, 803, 1367] },
    { key: TEXTURE_KEYS.playerRed, path: 'assets/player/player_red.png', enabled: true, crop: [108, 48, 809, 1369] },
    { key: TEXTURE_KEYS.ball, path: 'assets/ball/ball.png', enabled: true, crop: [360, 86, 815, 827] },
    { key: TEXTURE_KEYS.wall, path: 'assets/obstacles/wall.png', enabled: true, crop: [60, 292, 1417, 419] },
    { key: TEXTURE_KEYS.bumper, path: 'assets/obstacles/bumper.png', enabled: true, crop: [354, 78, 827, 839] },
    { key: TEXTURE_KEYS.boostPad, path: 'assets/obstacles/boost_pad.png', enabled: true, crop: [292, 38, 953, 925] }
  ],
  sounds: [
    { key: SOUND_KEYS.kick, path: 'assets/sounds/kick.mp3', enabled: true },
    { key: SOUND_KEYS.bumper, path: 'assets/sounds/bumper.mp3', enabled: true },
    { key: SOUND_KEYS.goal, path: 'assets/sounds/goal.mp3', enabled: true },
    { key: SOUND_KEYS.victory, path: 'assets/sounds/victory.mp3', enabled: true }
  ]
};
