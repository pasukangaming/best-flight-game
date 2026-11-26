// Solara Skies — tuning constants and shared numbers.
// One job: every magic number the rest of the game reads lives here,
// so balancing the flight model never means hunting through the renderer.

export const CONFIG = {
  // World
  worldSize: 4000, // terrain spans -2000..2000 on x and z (metres)
  terrainCells: 88, // quads across one side of the heightfield
  waterLevel: 0,
  viewDistance: 1700, // terrain quads farther than this are skipped
  fogDistance: 1500, // past this the haze swallows the far terrain

  // Flight model
  maxSpeed: 92, // m/s at full throttle
  cruiseSpeed: 55,
  stallSpeed: 24, // below this the Kestrel starts to sink
  throttleStep: 0.9, // per second while W / Shift is held
  pitchRate: 0.85, // radians per second of elevator authority
  rollRate: 1.9, // radians per second of aileron authority
  turnFromRoll: 0.62, // how much bank turns the nose
  gravitySink: 9.5, // m/s^2 of sink when stalled
  climbFactor: 0.9, // how much of the speed becomes climb at full pitch

  // Mission
  ringCount: 8,
  missionTime: 300, // seconds on the clock
  fuelMax: 100,
  fuelBurn: 0.55, // per second at full throttle
  ringScore: 250,
  landingScore: 500,
  timeBonusPerSecond: 5,

  // Camera
  chaseDistance: 15, // metres behind the plane
  chaseHeight: 5, // metres above the plane
  lookAhead: 34, // metres in front of the plane the camera aims at
  cameraRollFollow: 0.55, // how much of the plane's bank the camera takes
  fovDegrees: 68,

  // Runway (Solara Bay Airfield, heading north along -z)
  runway: { x: 0, z: -600, length: 720, width: 44, heading: 0 },

  // Scoring helpers
  crashVerticalSpeed: 6, // m/s of sink that breaks the plane on contact
  safeLandingSink: 3.2,
};

// Colours of Solara Bay, one palette for sky, sea and land.
export const PALETTE = {
  skyTop: '#2f6fd0',
  skyMid: '#7db3e8',
  skyHorizon: '#cfe6f7',
  sunCore: '#fff3c4',
  sunGlow: '#ffd76a',
  seaDeep: '#14608f',
  seaShallow: '#2f8fb8',
  sand: '#e8d9a8',
  grass: '#5da24a',
  forest: '#2f7a33',
  rock: '#8a7f74',
  snow: '#f4f8fb',
  runway: '#3a3f46',
  runwayMark: '#f2f2ea',
  ringGold: '#ffc233',
  ringGlow: '#ffdf7a',
  planeCream: '#f6ead2',
  planeTeal: '#1f7a8c',
  planeRed: '#c8442c',
  hudAmber: '#ffb347',
  hudGreen: '#7dff9a',
  hudRed: '#ff6b5e',
};
