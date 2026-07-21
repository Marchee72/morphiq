export interface Exercise {
  id: string;                 // dataset id, e.g. "0025"
  name: string;
  category: string;           // body-part category, e.g. "chest"
  equipment: string;          // e.g. "barbell", "body weight"
  target: string;             // primary target muscle
  muscleGroup: string;        // primary synergist muscle group
  secondaryMuscles: string[];
  instructionSteps: string[]; // English step-by-step
  image: string;              // repo-relative 180x180 jpg, e.g. "images/0025-EIeI8Vf.jpg"
  gifUrl: string;             // repo-relative 180x180 gif, e.g. "videos/0025-EIeI8Vf.gif"
  attribution: string;        // "© Gym visual — https://gymvisual.com/"
}
