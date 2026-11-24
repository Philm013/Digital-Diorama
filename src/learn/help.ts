/**
 * The Learn hub's reference: answers to "How do I…?" (each with the lesson that shows it, when
 * there is one), keyboard shortcuts, touch gestures, coding challenges and notes for teachers.
 */
export interface HelpItem { q: string; a: string; lesson?: string }
export interface HelpTopic { id: string; emoji: string; title: string; items: HelpItem[] }

export const HELP: HelpTopic[] = [
  {
    id: 'start', emoji: '🧭', title: 'Getting started', items: [
      { q: 'What do I do first?', a: 'Start an expedition in one of the open habitats. Your box starts as bare land: add plants, plant-eaters, predators and decomposers, keep the heart healthy and finish quests. The lessons in “Your first habitat” walk you through it.', lesson: 'studio' },
      { q: 'How does the ranger path work?', a: 'An expedition is complete when one of your own dioramas earns ⭐⭐ (10 quests). Each completed expedition unlocks the next step of the path: new habitats and new tools. Anything with a padlock tells you what opens it when you tap it.', lesson: 'quests' },
      { q: 'Where are my dioramas saved?', a: 'On this device, automatically, every time something changes. ⋯ More → Download project file saves a copy you can move to another device; “Open file” under My dioramas loads it again.' },
      { q: 'What are the example dioramas?', a: 'Finished, fully stocked habitats to compare with your own. A habitat’s example unlocks once you have completed an expedition there. They don’t count towards the ranger path.' },
    ],
  },
  {
    id: 'view', emoji: '🎥', title: 'Looking around', items: [
      { q: 'How do I move the camera?', a: 'Drag to turn around the box, pinch or scroll to zoom, and drag with two fingers (or the right mouse button) to slide. Overview (O) brings the whole box back.', lesson: 'camera' },
      { q: 'How do I see it from the inside?', a: 'Explore → Walk in. Choose the eye level of a person, fox, frog or ant — or fly over it as a bird. Leave (Esc) steps back out.', lesson: 'walk' },
      { q: 'How do I make it night, or change the weather?', a: 'Explore → the clock sets the time of day and runs a day–night cycle. Weather (once unlocked) brings rain, storms, snow, fog and wind.', lesson: 'time' },
      { q: 'What is Top view?', a: 'In Build, the map button (or T) looks straight down with a metre grid. It makes placing landforms and selecting areas easy.', lesson: 'landforms' },
    ],
  },
  {
    id: 'build', emoji: '🔨', title: 'Building', items: [
      { q: 'How do I add plants and animals?', a: 'Build → your inventory. Tap a tile to add it near the middle of your view, or drag it onto the land. “Here” shows only species of this habitat; search finds anything by name.', lesson: 'add' },
      { q: 'How do I move, turn or resize something?', a: 'Tap it in Build to select it, then drag it. The bar on it turns (↻ ↺) and resizes (＋ −); keys R, + and − do the same. On a touch screen, long-press picks anything up, and two fingers twist and pinch it.', lesson: 'edit' },
      { q: 'How do I copy or delete something?', a: 'Select it, then use Copy or 🗑 in the bar on it (keys D and Delete).', lesson: 'edit' },
      { q: 'I made a mistake — can I undo it?', a: '↶ Undo takes back your last change (Ctrl+Z); ↷ Redo puts it back (Ctrl+Shift+Z).', lesson: 'edit' },
      { q: 'Can a bird sit on a branch or a rock?', a: 'Yes: drag it from the inventory and drop it onto the plant or rock. Flyers and swimmers also have a height slider under Place.' },
      { q: 'Why are some little creatures so big?', a: 'Small creatures are magnified so you can see them — the field card says how much. Settings → True sizes turns it off.' },
    ],
  },
  {
    id: 'land', emoji: '🏔️', title: 'Land & water', items: [
      { q: 'How do I make hills, mountains or valleys?', a: 'Build with nothing selected → World & land → Landforms. Pick one, then tap the land — or press and drag to size and point it. A see-through preview shows it first.', lesson: 'landforms' },
      { q: 'How do I paint the ground?', a: 'Land tools → 🎨 Paint: choose one of 22 grounds (or ✨ Auto) and drag across the land.', lesson: 'paint' },
      { q: 'How do I add water?', a: 'Stamp a 💧 Lake landform, or switch Water on in the land tools and set its level.', lesson: 'paint' },
      { q: 'How do I raise or dig the land by hand?', a: 'Land tools → ✋ Sculpt (once unlocked): Raise, Dig, Smooth, Flatten and Rocky brushes. Hold still to keep building in one spot.', lesson: 'sculpt' },
      { q: 'How do I make my box bigger or smaller?', a: 'Build with nothing selected → World & land → Diorama size. Growing adds new land of the same habitat around the edges.' },
    ],
  },
  {
    id: 'eco', emoji: '💚', title: 'Living things & ecology', items: [
      { q: 'What do the coloured stripes on the inventory mean?', a: 'Each one’s role in the food web: green producers, yellow plant-eaters, orange predators, red top predators, brown decomposers and grey non-living things.', lesson: 'add' },
      { q: 'How is ecosystem health worked out?', a: 'The heart scores variety, producers–consumers–decomposers, food for every animal, a balanced food pyramid, long food chains and water. Tap it to see each part and tips on what to add.', lesson: 'health' },
      { q: 'How do I read the food web?', a: 'Explore → Food web. Arrows point from the food to the eater. Tap an organism to light up its links, and “What if…?” shows who would go hungry without it.', lesson: 'foodweb' },
      { q: 'Why does an animal have nothing to eat?', a: 'Hunters only eat prey they can really catch, and every animal eats particular foods. Its field card and the food web suggest species of the habitat that would feed it, with an Add button.', lesson: 'foodweb' },
      { q: 'How do I discover species for my journal?', a: 'In Explore, tap any living thing: its field card opens and it goes into your Field journal (J).', lesson: 'discover' },
    ],
  },
  {
    id: 'story', emoji: '🎤', title: 'Labels, notes & presenting', items: [
      { q: 'How do I write my own labels?', a: 'Build → select it → 🏷️ Label → Label text. L shows or hides all labels.', lesson: 'labels' },
      { q: 'Where do research notes go?', a: 'Build → select it → 🏷️ Label → My research notes. They show on its field card and are read aloud on the tour.', lesson: 'labels' },
      { q: 'How do I present my diorama?', a: 'Explore → Tour (once unlocked) flies to each species in food-chain order and can read your notes aloud.', lesson: 'tour' },
      { q: 'How do I save a picture?', a: '⋯ More → Save a picture downloads what the camera sees.' },
    ],
  },
  {
    id: 'code', emoji: '🧩', title: 'Code', items: [
      { q: 'How do I start coding?', a: 'Code (once unlocked) → choose an object in the row at the top → tap an idea, or drag in a yellow “when ▶ clicked” block from Events → press ▶ Play.', lesson: 'code' },
      { q: 'Why does everything jump back when I press Stop?', a: 'Stop puts the diorama back exactly as you built it, so scripts can never mess up your work.' },
      { q: 'Can I code the weather, time or camera?', a: 'Yes: choose 🌍 World at the start of the row. It has blocks for time, weather, seasons, captions and the camera.' },
      { q: 'How do I test one script?', a: 'Click any stack of blocks to run just that stack. Running blocks glow.' },
    ],
  },
];

export const KEYS: [string, string][] = [
  ['1 · 2 · 3', 'Explore · Build · Code'],
  ['H', 'Learn & help'],
  ['J · Q', 'Field journal · quests'],
  ['O', 'Overview (whole box)'],
  ['L', 'Labels on / off'],
  ['T', 'Top view (Build)'],
  ['R · Shift+R', 'Turn the selected object (or the landform)'],
  ['+ · −', 'Bigger · smaller'],
  ['D · Delete', 'Copy · delete the selected object'],
  ['F', 'Focus on the selected object'],
  ['[ · ]', 'Brush or landform size'],
  ['Ctrl+Z · Ctrl+Shift+Z', 'Undo · redo'],
  ['Ctrl+S', 'Save now'],
  ['Esc', 'Stop · put a tool away · deselect · leave'],
  ['W A S D · Shift', 'Walk · run (when walking in)'],
  ['Space · C', 'Jump or climb · dive (when walking in)'],
];

export const GESTURES: [string, string][] = [
  ['👆 Drag', 'Turn around the box'],
  ['🤏 Pinch', 'Zoom in and out'],
  ['✌️ Two-finger drag', 'Slide the view'],
  ['👆 Tap', 'Discover (Explore) · select (Build)'],
  ['✋ Long-press', 'Pick up anything (Build)'],
  ['🔄 Two-finger twist', 'Turn the object you’re holding'],
  ['👆 Drag the panel’s top', 'Give the panel or the view more room'],
  ['⬇️ Drag a sheet down', 'Close it (Back works too)'],
];

export const CHALLENGES = [
  '🐝 Make a bee visit three different flowers, then fly home.',
  '🦁 Code a predator–prey chase: the hunter uses “eat (nearest food)”, the prey uses “predator within 5 m?” and “run away”.',
  '🌙 When it becomes night, make the owl hoot and fly; when it becomes day, make it sleep.',
  '🦎 Use “set colour” to make a chameleon or octopus camouflage itself when tapped.',
  '🌧️ Write a World script that tells the story of the water cycle with captions, rain and a rainbow.',
  '❓ Add a quiz: tap an animal, ask “What do I eat?”, and check the answer.',
  '👶 Population model: each time you tap a rabbit it “has a baby” — what happens to the grass?',
];

export interface TeacherNote { emoji: string; title: string; text: string; list?: string[] }
export const TEACHER_NOTES: TeacherNote[] = [
  {
    emoji: '🎓', title: 'Ranger training', text: 'Twenty short lessons in six units teach the app by doing: each step points at a real button and moves on when the student has done it. They run inside the student’s own diorama, so the first unit also starts their first expedition. Units open along the ranger path with the tools they teach, and every quest has a “Show me” button that starts the lesson for it.',
  },
  {
    emoji: '🗓️', title: 'A first session (30–40 minutes)', text: 'A plan that works for most classes:', list: [
      'Start an expedition in the Backyard, Temperate Forest or Prairie.',
      'Choose “Show me around” and follow Your first habitat (about 8 minutes).',
      'Follow Keep it healthy: the heart, the food web and quests.',
      'Free building towards ⭐⭐ — the quest tracker always shows the next steps.',
      'Share: each student explains one food chain from their diorama.',
    ],
  },
  {
    emoji: '🧭', title: 'The ranger path', text: 'Students start with three habitats and the basic tools. Each completed expedition (⭐⭐ on a diorama of their own) unlocks the next step: Wetland & Savanna and coding, then deserts and tours, rainforests and the Area tool, and so on. To open everything on this device at once, switch on teacher mode at the top of this page (or in Settings on the home screen).',
  },
  {
    emoji: '✅', title: 'Quests as a rubric', text: 'Each diorama’s 16 quests cover the ecology a habitat project should show: producers, consumers and decomposers, a three-link food chain, water and non-living features, a healthy score, labels and research notes. Explore → Guide shows the same checklist next to the habitat’s climate, adaptations, threats, vocabulary and discussion questions.',
  },
  {
    emoji: '💾', title: 'Saving and sharing work', text: 'Work saves on the device it was made on (and in that browser). To hand work in or move it, use ⋯ More → Download project file; open it again from My dioramas → Open file. ⋯ More → Save a picture makes a screenshot.',
  },
];
