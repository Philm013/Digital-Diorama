export type Family = 'mammal' | 'bird' | 'wildform' | 'reptile' | 'plant' | 'deciduous' | 'rock' | 'water' | 'beach' | 'aquarium' | 'builtin' | 'flora';
export type Locomotion = 'walk' | 'fly' | 'swim' | 'slither' | 'hop' | 'crawl' | 'sessile' | 'scenery';
export type Category = 'animals' | 'plants' | 'fungi' | 'habitats' | 'water' | 'land' | 'sky' | 'human' | 'finds';
export type Diet = 'herbivore' | 'carnivore' | 'omnivore' | 'insectivore' | 'piscivore' | 'filter feeder' | 'detritivore' | 'decomposer' | 'producer' | 'nectarivore' | 'frugivore' | 'scavenger' | 'parasite' | 'carnivorous plant' | 'none';

export interface SpeciesInfo {
  scientific?: string;
  kingdom?: 'Animalia' | 'Plantae' | 'Fungi' | 'Chromista' | 'Protista';
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  diet?: Diet;
  habitat?: string;
  status?: string;
  fact?: string;
  size?: string;
  /** food tags or asset ids this organism eats */
  eats?: string[];
  /** what this organism counts as when something eats it */
  tags?: string[];
  blurb?: string;
}

export interface AssetDef {
  id: string;
  name: string;
  emoji: string;
  category: Category;
  group: string;
  family: Family;
  path: string;
  params: Record<string, unknown>;
  hidden?: string[];
  loco: Locomotion;
  biomes: string[];
  info: SpeciesInfo;
  /** yaw (radians) that turns the raw model to face +Z */
  yaw?: number;
  /** default height above the ground (flyers) or below the water surface (swimmers) */
  lift?: number;
  /** real-world body length (m) used for the exhibit-scale magnification */
  realLength?: number;
  /** explicit display scale, overrides the exhibit formula */
  scale?: number;
  /** where an aquatic thing lives */
  water?: 'surface' | 'column' | 'bed';
  /** habitat tile usable as the diorama base */
  base?: boolean;
  heavy?: boolean;
  /** remove the asset's own water meshes (it floats in the diorama's water instead) */
  stripWater?: boolean;
  /** natural cruising speed in m/s */
  speed?: number;
  living?: boolean;
  /** rebuilt when the diorama's season changes (blossom, autumn colour, bare winters) */
  seasonal?: boolean;
  /** typical adult mass (kg), for who can catch whom in the food web */
  mass?: number;
}

